/**
 * 简易折线图组件
 * 使用 SVG 实现，无需额外依赖
 */

import React from 'react';

/**
 * 折线图组件
 * @param {Array} data - 数据点数组 [{ x, y, label }]
 * @param {number} width - 图表宽度
 * @param {number} height - 图表高度
 * @param {string} color - 线条颜色
 * @param {boolean} showDots - 是否显示数据点
 * @param {boolean} showArea - 是否显示面积填充
 * @param {boolean} showGrid - 是否显示网格
 * @param {function} formatY - Y 轴格式化函数
 */
function LineChart({
  data = [],
  width = 400,
  height = 200,
  color = '#3b82f6',
  showDots = true,
  showArea = true,
  showGrid = true,
  formatY = (v) => v.toFixed(1),
  className = '',
}) {
  if (!data || data.length < 2) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-50 rounded-lg ${className}`}
        style={{ width, height }}
      >
        <span className="text-sm text-gray-400">数据不足</span>
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 计算数据范围
  const yValues = data.map((d) => d.y);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const yRange = maxY - minY || 1;
  const yPadding = yRange * 0.1;

  const actualMinY = minY - yPadding;
  const actualMaxY = maxY + yPadding;
  const actualRange = actualMaxY - actualMinY;

  // 转换坐标
  const getX = (i) => padding.left + (i / (data.length - 1)) * chartWidth;
  const getY = (y) => padding.top + chartHeight - ((y - actualMinY) / actualRange) * chartHeight;

  // 生成路径
  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.y)}`)
    .join(' ');

  const areaPath = `${linePath} L ${getX(data.length - 1)} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`;

  // 网格线
  const gridLines = [];
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const y = padding.top + (chartHeight / yTicks) * i;
    const value = actualMaxY - (actualRange / yTicks) * i;
    gridLines.push({ y, value });
  }

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* 网格 */}
      {showGrid && (
        <g className="grid">
          {gridLines.map((line, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                y1={line.y}
                x2={width - padding.right}
                y2={line.y}
                stroke="#e5e7eb"
                strokeDasharray="4,4"
              />
              <text
                x={padding.left - 8}
                y={line.y + 4}
                textAnchor="end"
                className="text-xs fill-gray-400"
              >
                {formatY(line.value)}
              </text>
            </g>
          ))}
        </g>
      )}

      {/* 面积填充 */}
      {showArea && (
        <path
          d={areaPath}
          fill={color}
          fillOpacity={0.1}
        />
      )}

      {/* 折线 */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 数据点 */}
      {showDots && data.map((d, i) => (
        <circle
          key={i}
          cx={getX(i)}
          cy={getY(d.y)}
          r={4}
          fill="white"
          stroke={color}
          strokeWidth={2}
        >
          <title>{d.label || `${formatY(d.y)}`}</title>
        </circle>
      ))}

      {/* X 轴标签 */}
      {data.length <= 10 && data.map((d, i) => (
        d.x && (
          <text
            key={i}
            x={getX(i)}
            y={height - 8}
            textAnchor="middle"
            className="text-xs fill-gray-400"
          >
            {d.x}
          </text>
        )
      ))}
    </svg>
  );
}

export default LineChart;
