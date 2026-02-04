/**
 * 简易饼图组件
 * 使用 SVG 实现，无需额外依赖
 */

import React from 'react';

/**
 * 饼图组件
 * @param {Array} data - 数据数组 [{ value, label, color }]
 * @param {number} size - 图表大小
 * @param {number} innerRadius - 内圆半径 (0 为实心饼图)
 * @param {boolean} showLabels - 是否显示标签
 * @param {boolean} showLegend - 是否显示图例
 */
function PieChart({
  data = [],
  size = 200,
  innerRadius = 0,
  showLabels = false,
  showLegend = true,
  className = '',
}) {
  if (!data || data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 rounded-lg ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-sm text-gray-400">暂无数据</span>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 rounded-lg ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-sm text-gray-400">数据为空</span>
      </div>
    );
  }

  const radius = size / 2 - 10;
  const centerX = size / 2;
  const centerY = size / 2;

  // 默认颜色
  const defaultColors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#f97316', // orange
    '#ec4899', // pink
  ];

  // 计算扇形路径
  let currentAngle = -Math.PI / 2; // 从顶部开始
  const slices = data.map((d, i) => {
    const angle = (d.value / total) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    const largeArc = angle > Math.PI ? 1 : 0;

    let path;
    if (innerRadius > 0) {
      // 环形
      const ix1 = centerX + innerRadius * Math.cos(startAngle);
      const iy1 = centerY + innerRadius * Math.sin(startAngle);
      const ix2 = centerX + innerRadius * Math.cos(endAngle);
      const iy2 = centerY + innerRadius * Math.sin(endAngle);

      path = `
        M ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
        L ${ix2} ${iy2}
        A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}
        Z
      `;
    } else {
      // 实心
      path = `
        M ${centerX} ${centerY}
        L ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
        Z
      `;
    }

    // 标签位置
    const labelAngle = startAngle + angle / 2;
    const labelRadius = radius * 0.7;
    const labelX = centerX + labelRadius * Math.cos(labelAngle);
    const labelY = centerY + labelRadius * Math.sin(labelAngle);

    return {
      ...d,
      path,
      color: d.color || defaultColors[i % defaultColors.length],
      percentage: Math.round((d.value / total) * 100),
      labelX,
      labelY,
    };
  });

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, i) => (
          <g key={i}>
            <path
              d={slice.path}
              fill={slice.color}
              stroke="white"
              strokeWidth={2}
              className="transition-opacity hover:opacity-80"
            >
              <title>{`${slice.label}: ${slice.value} (${slice.percentage}%)`}</title>
            </path>
            {showLabels && slice.percentage > 5 && (
              <text
                x={slice.labelX}
                y={slice.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xs fill-white font-medium"
              >
                {slice.percentage}%
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* 图例 */}
      {showLegend && (
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          {slices.map((slice, i) => (
            <div key={i} className="flex items-center space-x-1.5">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: slice.color }}
              ></div>
              <span className="text-xs text-gray-600">
                {slice.label} ({slice.percentage}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PieChart;
