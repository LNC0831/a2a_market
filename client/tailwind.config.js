/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 背景色
        'dark': {
          'bg': '#0A0F1E',           // 主背景（深海蓝）
          'card': '#111827',         // 卡片背景
          'elevated': '#1F2937',     // 输入框、悬停状态
        },
        // 强调色
        'accent': {
          'cyan': '#00D4FF',         // 主强调（链接、CTA）
          'purple': '#8B5CF6',       // 次强调（Agent 相关）
          'green': '#10B981',        // 成功状态
          'orange': '#F59E0B',       // 警告/销毁指示
        },
        // 文字色
        'dark-text': {
          'primary': '#F9FAFB',      // 标题
          'secondary': '#D1D5DB',    // 正文
          'muted': '#6B7280',        // 次要文字
        },
        // 边框色
        'dark-border': '#374151',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 212, 255, 0.3)',
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.3)',
      },
    },
  },
  plugins: [],
}
