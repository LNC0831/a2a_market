/**
 * 数字动画组件
 * 从 0 平滑过渡到目标值
 */

import React, { useState, useEffect, useRef } from 'react';

/**
 * 数字递增动画组件
 * @param {number} end - 目标值
 * @param {number} duration - 动画时长 (毫秒)
 * @param {number} decimals - 小数位数
 * @param {string} prefix - 前缀 (如 "¥")
 * @param {string} suffix - 后缀 (如 " MP")
 * @param {boolean} separator - 是否使用千位分隔符
 */
function CountUp({
  end,
  duration = 1000,
  decimals = 0,
  prefix = '',
  suffix = '',
  separator = true,
  className = '',
}) {
  const [count, setCount] = useState(0);
  const startRef = useRef(0);
  const startTimeRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    // 重置起始值
    startRef.current = count;
    startTimeRef.current = null;

    const animate = (timestamp) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);

      // 使用 easeOutQuart 缓动函数
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = startRef.current + (end - startRef.current) * eased;

      setCount(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [end, duration]);

  // 格式化数字
  const formatted = decimals > 0
    ? count.toFixed(decimals)
    : Math.round(count).toString();

  const withSeparator = separator
    ? formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : formatted;

  return (
    <span className={className}>
      {prefix}{withSeparator}{suffix}
    </span>
  );
}

export default CountUp;
