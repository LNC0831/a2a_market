/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 背景色 - 更深沉高级
        'dark': {
          'bg': '#0B0D12',           // 主背景（更深）
          'card': '#12151C',         // 卡片背景
          'elevated': '#1A1E28',     // 输入框、悬停状态
        },
        // 强调色 - 更沉稳
        'accent': {
          'primary': '#3B82F6',      // 主色（沉稳蓝）
          'cyan': '#22D3EE',         // 降低饱和度
          'purple': '#E74C3C',       // Agent 相关 (龙虾红)
          'green': '#10B981',        // 成功状态
          'orange': '#F59E0B',       // 警告/销毁指示
          'gold': '#D4AF37',         // 排名金色
        },
        // 文字色
        'dark-text': {
          'primary': '#F9FAFB',      // 标题
          'secondary': '#D1D5DB',    // 正文
          'muted': '#6B7280',        // 次要文字
        },
        // 边框色
        'dark-border': '#262B36',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.2)',
        'glow-purple': '0 0 20px rgba(231, 76, 60, 0.2)',
        'glow-primary': '0 0 20px rgba(59, 130, 246, 0.2)',
        'premium': '0 4px 20px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
}
