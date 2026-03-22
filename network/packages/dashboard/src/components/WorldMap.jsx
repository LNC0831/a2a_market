import React, { useMemo } from 'react'

/**
 * WorldMap - SVG-based world map with agent node markers
 *
 * Since we don't have real geolocation yet, nodes are placed using
 * a deterministic hash of their agentId to generate map coordinates.
 * This gives a consistent, visually appealing distribution.
 *
 * Future: use GeoIP or agent-reported location for real positioning.
 */

// Simple hash to generate deterministic x,y from a string
function hashToPosition(str) {
  let h1 = 0, h2 = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = ((h1 << 5) - h1 + ch) | 0
    h2 = ((h2 << 7) - h2 + ch * 31) | 0
  }
  // Map to world coordinates (roughly)
  // x: 5% to 95% of width, y: 15% to 85% of height
  const x = 5 + (Math.abs(h1) % 9000) / 100
  const y = 15 + (Math.abs(h2) % 7000) / 100
  return { x, y }
}

// Simplified world continents outline (SVG path)
const WORLD_PATH = `
M 15,40 Q 20,35 25,38 L 28,42 Q 30,50 25,55 L 20,52 Q 12,48 15,40 Z
M 30,30 Q 35,25 45,28 L 48,35 Q 50,42 45,48 L 38,50 Q 32,45 30,38 Z
M 52,25 Q 58,20 68,22 L 75,28 Q 78,35 72,42 L 65,45 Q 55,40 52,32 Z
M 60,45 Q 62,42 65,44 L 66,48 Q 64,52 60,50 Z
M 72,30 Q 80,25 88,28 L 92,35 Q 90,42 85,45 L 78,42 Q 74,38 72,30 Z
M 75,48 Q 82,45 88,50 L 85,58 Q 80,62 75,58 Z
`

function NodeMarker({ peer, x, y }) {
  const isSelf = peer.isSelf

  return (
    <g className="cursor-pointer" style={{ transform: `translate(${x}%, ${y}%)` }}>
      {/* Glow effect */}
      <circle
        cx="0" cy="0" r={isSelf ? 4 : 2.5}
        fill={isSelf ? '#22c55e' : '#0c8ee9'}
        opacity={0.3}
        className={isSelf ? 'animate-ping' : ''}
      />
      {/* Node dot */}
      <circle
        cx="0" cy="0" r={isSelf ? 2.5 : 1.5}
        fill={isSelf ? '#22c55e' : '#36a9f8'}
        stroke={isSelf ? '#166534' : '#0159a1'}
        strokeWidth="0.5"
      />
      {/* Label */}
      <text
        x="0" y={-5}
        textAnchor="middle"
        fill={isSelf ? '#86efac' : '#93c5fd'}
        fontSize="2.5"
        fontWeight={isSelf ? 'bold' : 'normal'}
      >
        {peer.name || peer.agentId?.slice(0, 12)}
      </text>
    </g>
  )
}

export default function WorldMap({ peers }) {
  const nodePositions = useMemo(() => {
    return peers.map(peer => ({
      peer,
      ...hashToPosition(peer.agentId || peer.name || Math.random().toString())
    }))
  }, [peers])

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-300">Global Agent Network</h2>
        <span className="text-xs text-gray-600">
          {peers.length} node{peers.length !== 1 ? 's' : ''} visible
        </span>
      </div>

      <div className="relative map-grid" style={{ aspectRatio: '2/1' }}>
        <svg
          viewBox="0 0 100 50"
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background */}
          <rect width="100" height="50" fill="transparent" />

          {/* Continents (simplified) */}
          <path
            d={WORLD_PATH}
            fill="rgba(100, 116, 139, 0.08)"
            stroke="rgba(100, 116, 139, 0.15)"
            strokeWidth="0.3"
          />

          {/* Grid lines */}
          {[10, 20, 30, 40].map(y => (
            <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y}
              stroke="rgba(100, 116, 139, 0.05)" strokeWidth="0.2" />
          ))}
          {[20, 40, 60, 80].map(x => (
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="50"
              stroke="rgba(100, 116, 139, 0.05)" strokeWidth="0.2" />
          ))}

          {/* Connection lines between nodes */}
          {nodePositions.length > 1 && nodePositions.map((node, i) => {
            if (i === 0) return null
            const prev = nodePositions[i - 1]
            return (
              <line
                key={`line-${i}`}
                x1={node.x} y1={node.y}
                x2={prev.x} y2={prev.y}
                stroke="rgba(12, 142, 233, 0.15)"
                strokeWidth="0.3"
                strokeDasharray="1,1"
              />
            )
          })}

          {/* Node markers */}
          {nodePositions.map((node, i) => (
            <NodeMarker
              key={node.peer.agentId || i}
              peer={node.peer}
              x={node.x}
              y={node.y}
            />
          ))}

          {/* Empty state */}
          {peers.length === 0 && (
            <text x="50" y="25" textAnchor="middle" fill="#4b5563" fontSize="3">
              Connect to a node to see the network
            </text>
          )}
        </svg>
      </div>
    </div>
  )
}
