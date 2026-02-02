// i18n 配置文件
export const translations = {
  zh: {
    // 通用
    appName: 'AI Task Market',
    appTagline: '智能任务市场 · 全自动交付',
    loading: '加载中...',
    back: '返回',
    submit: '提交',
    cancel: '取消',
    confirm: '确认',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    create: '创建',
    search: '搜索',
    filter: '筛选',
    sort: '排序',
    price: '价格',
    status: '状态',
    type: '类型',
    date: '日期',
    actions: '操作',
    
    // 导航
    navHome: '首页',
    navAdmin: '管理后台',
    navSkills: '技能商店',
    navAgents: 'Agent市场',
    navPricing: '定价',
    navAbout: '关于',
    
    // 首页
    heroTitle: '提交任务，AI自动完成',
    heroSubtitle: '选择任务类型，几分钟内获得专业级交付结果',
    featureFast: '快速交付',
    featureQuality: '质量保证',
    featureSecure: '安全支付',
    howItWorks: '工作流程',
    step1Title: '提交任务',
    step1Desc: '选择任务类型，填写需求',
    step2Title: '安全支付',
    step2Desc: '在线支付，资金托管',
    step3Title: 'AI处理',
    step3Desc: '智能Agent自动执行任务',
    step4Title: '获取结果',
    step4Desc: '质量检查，交付成果',
    
    // 任务类型
    taskContentWriting: '内容写作',
    taskCodeReview: '代码审查',
    taskDataAnalysis: '数据分析',
    taskTranslation: '文档翻译',
    taskImageAnalysis: '图像分析',
    taskMarketing: '营销文案',
    
    // 任务表单
    formTitle: '任务标题',
    formTitlePlaceholder: '例如：写一篇关于AI的博客文章',
    formDescription: '详细需求',
    formDescriptionPlaceholder: '请详细描述您的需求，包括格式要求、风格偏好、字数限制等...',
    formEmail: '联系邮箱',
    formEmailPlaceholder: 'your@email.com',
    formEmailHint: '结果将通过邮件发送给您',
    formPrice: '服务费用',
    formDeliveryTime: '预计交付时间',
    formSubmit: '立即支付并提交任务',
    formProcessing: '处理中...',
    
    // 任务状态
    statusPending: '等待处理',
    statusParsing: '解析需求',
    statusQuoted: '已报价',
    statusAssigned: '已分配',
    statusProcessing: '处理中',
    statusReviewing: '审核中',
    statusCompleted: '已完成',
    statusFailed: '处理失败',
    
    // 状态页面
    taskCreated: '任务已创建',
    taskProcessing: 'AI正在处理您的任务...',
    taskCompleted: '任务完成！',
    taskResult: '执行结果',
    downloadResult: '下载结果',
    taskTips: '提示',
    taskTip1: '任务处理完成后，结果将自动显示在此页面',
    taskTip2: '同时会发送邮件通知到您的邮箱',
    taskTip3: '请保存任务ID，方便后续查询',
    
    // 管理后台
    adminTitle: '管理后台',
    adminStats: '统计数据',
    adminTotalTasks: '总任务数',
    adminTotalRevenue: '总收入',
    adminCompletedTasks: '已完成',
    adminAvgQuality: '平均质量分',
    adminTaskList: '任务列表',
    adminNoTasks: '暂无任务数据',
    
    // 货币
    currency: '¥',
    currencyUSD: '$',
    
    // 技能商店
    skillStore: '技能商店',
    skillDeveloper: '开发者',
    skillRating: '评分',
    skillCalls: '调用次数',
    skillPrice: '单价',
    
    // Agent市场
    agentMarket: 'Agent市场',
    agentType: 'Agent类型',
    agentSuccessRate: '成功率',
    agentTotalTasks: '完成任务',
    
    // 页脚
    footerRights: '© 2026 AI Task Market. Powered by AI Agents.',
    footerTerms: '服务条款',
    footerPrivacy: '隐私政策',
    footerContact: '联系我们',
    
    // 语言切换
    language: '语言',
    langZh: '简体中文',
    langEn: 'English',
  },
  
  en: {
    // General
    appName: 'AI Task Market',
    appTagline: 'Smart Task Marketplace · Fully Automated Delivery',
    loading: 'Loading...',
    back: 'Back',
    submit: 'Submit',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    price: 'Price',
    status: 'Status',
    type: 'Type',
    date: 'Date',
    actions: 'Actions',
    
    // Navigation
    navHome: 'Home',
    navAdmin: 'Admin',
    navSkills: 'Skill Store',
    navAgents: 'Agent Market',
    navPricing: 'Pricing',
    navAbout: 'About',
    
    // Homepage
    heroTitle: 'Submit Tasks, AI Does the Rest',
    heroSubtitle: 'Choose a task type, get professional results in minutes',
    featureFast: 'Fast Delivery',
    featureQuality: 'Quality Assured',
    featureSecure: 'Secure Payment',
    howItWorks: 'How It Works',
    step1Title: 'Submit Task',
    step1Desc: 'Select task type, fill requirements',
    step2Title: 'Secure Payment',
    step2Desc: 'Pay online, funds held in escrow',
    step3Title: 'AI Processing',
    step3Desc: 'Intelligent Agents execute automatically',
    step4Title: 'Get Results',
    step4Desc: 'Quality check, deliver results',
    
    // Task Types
    taskContentWriting: 'Content Writing',
    taskCodeReview: 'Code Review',
    taskDataAnalysis: 'Data Analysis',
    taskTranslation: 'Document Translation',
    taskImageAnalysis: 'Image Analysis',
    taskMarketing: 'Marketing Copy',
    
    // Task Form
    formTitle: 'Task Title',
    formTitlePlaceholder: 'e.g., Write a blog post about AI',
    formDescription: 'Detailed Requirements',
    formDescriptionPlaceholder: 'Describe your needs in detail: format, style, word count, etc.',
    formEmail: 'Contact Email',
    formEmailPlaceholder: 'your@email.com',
    formEmailHint: 'Results will be sent to this email',
    formPrice: 'Service Fee',
    formDeliveryTime: 'Estimated Delivery',
    formSubmit: 'Pay & Submit Task',
    formProcessing: 'Processing...',
    
    // Task Status
    statusPending: 'Pending',
    statusParsing: 'Parsing',
    statusQuoted: 'Quoted',
    statusAssigned: 'Assigned',
    statusProcessing: 'Processing',
    statusReviewing: 'Reviewing',
    statusCompleted: 'Completed',
    statusFailed: 'Failed',
    
    // Status Page
    taskCreated: 'Task Created',
    taskProcessing: 'AI is processing your task...',
    taskCompleted: 'Task Completed!',
    taskResult: 'Execution Result',
    downloadResult: 'Download Result',
    taskTips: 'Tips',
    taskTip1: 'Results will appear here automatically when ready',
    taskTip2: 'Email notification will be sent to your inbox',
    taskTip3: 'Save the Task ID for future reference',
    
    // Admin
    adminTitle: 'Admin Dashboard',
    adminStats: 'Statistics',
    adminTotalTasks: 'Total Tasks',
    adminTotalRevenue: 'Total Revenue',
    adminCompletedTasks: 'Completed',
    adminAvgQuality: 'Avg Quality',
    adminTaskList: 'Task List',
    adminNoTasks: 'No task data yet',
    
    // Currency
    currency: '$',
    currencyUSD: '$',
    
    // Skill Store
    skillStore: 'Skill Store',
    skillDeveloper: 'Developer',
    skillRating: 'Rating',
    skillCalls: 'Calls',
    skillPrice: 'Price',
    
    // Agent Market
    agentMarket: 'Agent Market',
    agentType: 'Agent Type',
    agentSuccessRate: 'Success Rate',
    agentTotalTasks: 'Tasks Completed',
    
    // Footer
    footerRights: '© 2026 AI Task Market. Powered by AI Agents.',
    footerTerms: 'Terms of Service',
    footerPrivacy: 'Privacy Policy',
    footerContact: 'Contact Us',
    
    // Language
    language: 'Language',
    langZh: '简体中文',
    langEn: 'English',
  }
};

// 获取当前语言
export const getCurrentLang = () => {
  return localStorage.getItem('appLanguage') || 'en';
};

// 设置语言
export const setLanguage = (lang) => {
  localStorage.setItem('appLanguage', lang);
  window.location.reload();
};

// 翻译函数
export const t = (key, lang = null) => {
  const currentLang = lang || getCurrentLang();
  return translations[currentLang]?.[key] || translations['en'][key] || key;
};

export default translations;
