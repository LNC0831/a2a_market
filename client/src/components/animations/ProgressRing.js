/**
 * 环形进度条组件
 */

import React from 'react';

/**
 * 环形进度条
 * @param {number} progress - 进度 (0-100)
 * @param {number} size - 尺寸
 * @param {number} strokeWidth - 线条宽度
 * @param {string} color - 进度条颜色
 * @param {string} bgColor - 背景颜色
 * @param {boolean} showPercent - 是否显示百分比
 * @param {React.ReactNode} children - 中心内容
 */
function ProgressRing({
  progress = 0,
  size = 120,
  strokeWidth = 8,
  color = '#3b82f6',
  bgColor = '#e5e7eb',
  showPercent = false,
  children,
  className = '',
}) {
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (normalizedProgress / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* 背景圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        {/* 进度圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>

      {/* 中心内容 */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children || (showPercent && (
          <span className="text-lg font-bold text-gray-700">
            {Math.round(normalizedProgress)}%
          </span>
        ))}
      </div>
    </div>
  );
}

export default ProgressRing;
