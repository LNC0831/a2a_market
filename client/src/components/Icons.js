/**
 * 统一图标组件
 * 使用 Heroicons (https://heroicons.com)
 */

import {
  CpuChipIcon,
  UserIcon,
  UsersIcon,
  DocumentTextIcon,
  StarIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  TrophyIcon,
  SparklesIcon,
  BoltIcon,
  CodeBracketIcon,
  LanguageIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  HomeIcon,
  BuildingStorefrontIcon,
  PlusCircleIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  BellIcon,
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  FunnelIcon,
  AdjustmentsHorizontalIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  EllipsisHorizontalIcon,
  Bars3Icon,
  XMarkIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';

import {
  StarIcon as StarSolidIcon,
  CheckCircleIcon as CheckCircleSolidIcon,
  CpuChipIcon as CpuChipSolidIcon,
} from '@heroicons/react/24/solid';

// 导出所有图标
export {
  // 用户相关
  CpuChipIcon as AgentIcon,
  CpuChipSolidIcon as AgentSolidIcon,
  UserIcon,
  UsersIcon,

  // 任务相关
  DocumentTextIcon as TaskIcon,
  PencilSquareIcon as WriteIcon,
  CodeBracketIcon as CodeIcon,
  LanguageIcon as TranslateIcon,
  MagnifyingGlassIcon as AnalysisIcon,

  // 状态相关
  CheckCircleIcon,
  CheckCircleSolidIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon as WarningIcon,
  InformationCircleIcon as InfoIcon,

  // 评分相关
  StarIcon,
  StarSolidIcon,
  TrophyIcon,
  SparklesIcon,

  // 金融相关
  CurrencyDollarIcon as MoneyIcon,
  ArrowTrendingUpIcon as TrendingIcon,
  ChartBarIcon as StatsIcon,

  // 导航相关
  HomeIcon,
  BuildingStorefrontIcon as HallIcon,
  PlusCircleIcon as AddIcon,
  Cog6ToothIcon as SettingsIcon,
  ArrowRightOnRectangleIcon as LoginIcon,
  ArrowLeftOnRectangleIcon as LogoutIcon,

  // 操作相关
  ArrowPathIcon as RefreshIcon,
  FunnelIcon as FilterIcon,
  AdjustmentsHorizontalIcon as SortIcon,
  BellIcon as NotificationIcon,
  ChatBubbleLeftRightIcon as MessageIcon,
  ShieldCheckIcon as VerifiedIcon,
  BoltIcon as FastIcon,

  // UI 相关
  ChevronRightIcon,
  ChevronDownIcon,
  EllipsisHorizontalIcon as MoreIcon,
  Bars3Icon as MenuIcon,
  XMarkIcon as CloseIcon,
  BookOpenIcon as BookIcon,
};

// 技能图标映射
export const skillIcons = {
  writing: PencilSquareIcon,
  coding: CodeBracketIcon,
  translation: LanguageIcon,
  analysis: MagnifyingGlassIcon,
  general: Cog6ToothIcon,
};

// 获取技能图标
export function getSkillIcon(skill) {
  return skillIcons[skill] || Cog6ToothIcon;
}

// 技能标签颜色
export const skillColors = {
  writing: 'bg-blue-100 text-blue-700 border-blue-200',
  coding: 'bg-green-100 text-green-700 border-green-200',
  translation: 'bg-purple-100 text-purple-700 border-purple-200',
  analysis: 'bg-orange-100 text-orange-700 border-orange-200',
  general: 'bg-gray-100 text-gray-700 border-gray-200',
};

// 技能中文名
export const skillLabels = {
  writing: '写作',
  coding: '编程',
  translation: '翻译',
  analysis: '分析',
  general: '通用',
};

// 状态配置
export const statusConfig = {
  open: {
    label: '待接单',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: ClockIcon,
  },
  claimed: {
    label: '执行中',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: BoltIcon,
  },
  submitted: {
    label: '待验收',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: MagnifyingGlassIcon,
  },
  completed: {
    label: '已完成',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircleIcon,
  },
  rejected: {
    label: '已拒绝',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircleIcon,
  },
  cancelled: {
    label: '已取消',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: XCircleIcon,
  },
};

// 徽章配置
export const badgeConfig = {
  gold: {
    label: '金牌',
    color: 'bg-yellow-400 text-yellow-900',
    gradient: 'from-yellow-300 to-yellow-500',
  },
  silver: {
    label: '银牌',
    color: 'bg-gray-300 text-gray-800',
    gradient: 'from-gray-200 to-gray-400',
  },
  bronze: {
    label: '铜牌',
    color: 'bg-orange-400 text-orange-900',
    gradient: 'from-orange-300 to-orange-500',
  },
  blue: {
    label: '新星',
    color: 'bg-blue-400 text-blue-900',
    gradient: 'from-blue-300 to-blue-500',
  },
};
