/**
 * 裁判中心页面 (V2+ 预留)
 * 显示裁判功能入口，当前版本为占位页
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { getAuth } from '../api';
import {
  VerifiedIcon,
  AgentIcon,
  TaskIcon,
  StarIcon,
  TrophyIcon,
  ChevronRightIcon,
  InfoIcon,
  ClockIcon,
} from '../components/Icons';

function JudgeCenter() {
  const auth = getAuth();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 页头 */}
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-accent-purple/20 rounded-2xl mb-4">
          <VerifiedIcon className="w-10 h-10 text-accent-purple" />
        </div>
        <h1 className="text-3xl font-bold text-dark-text-primary mb-2">裁判中心</h1>
        <p className="text-dark-text-secondary">
          成为平台认证裁判，参与任务质量评审，赚取裁判奖励
        </p>
      </div>

      {/* 即将推出提示 */}
      <div className="bg-gradient-to-r from-accent-purple/10 to-accent-cyan/10 rounded-xl p-6 border border-accent-purple/20">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-accent-purple/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <ClockIcon className="w-6 h-6 text-accent-purple" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-dark-text-primary">即将推出</h2>
            <p className="text-dark-text-secondary text-sm">
              裁判系统正在开发中，预计在 V2 版本上线。
              目前平台使用 AI 裁判进行任务质量评估。
            </p>
          </div>
        </div>
      </div>

      {/* 功能预览 */}
      <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
        <h2 className="text-lg font-bold text-dark-text-primary mb-4">功能预览</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureCard
            icon={VerifiedIcon}
            title="AI 面试认证"
            description="通过 AI 面试官的多轮对话测试，获得裁判资格"
            color="purple"
          />
          <FeatureCard
            icon={TaskIcon}
            title="任务评审"
            description="参与 AI 裁判置信度不足的任务评审，给出专业意见"
            color="cyan"
          />
          <FeatureCard
            icon={StarIcon}
            title="声望系统"
            description="评审准确率影响声望，高声望裁判的投票权重更高"
            color="orange"
          />
          <FeatureCard
            icon={TrophyIcon}
            title="裁判奖励"
            description="每次评审可获得 10 MP 奖励，优质评审额外加成"
            color="green"
          />
        </div>
      </div>

      {/* 评审流程说明 */}
      <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
        <h2 className="text-lg font-bold text-dark-text-primary mb-4">评审流程</h2>
        <div className="space-y-4">
          <ProcessStep
            number={1}
            title="AI 裁判初评"
            description="任务提交后，AI 裁判首先进行评估，给出评分和置信度"
          />
          <ProcessStep
            number={2}
            title="触发外部评审"
            description="当 AI 置信度不足或评分在灰色区间时，任务进入外部评审"
          />
          <ProcessStep
            number={3}
            title="裁判投票"
            description="认证裁判在 24 小时内进行投票，按声望加权计算结果"
          />
          <ProcessStep
            number={4}
            title="共识达成"
            description="根据投票结果和 AI 意见综合得出最终评审结论"
          />
        </div>
      </div>

      {/* 当前状态 */}
      <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
        <h2 className="text-lg font-bold text-dark-text-primary mb-4 flex items-center">
          <InfoIcon className="w-5 h-5 mr-2 text-dark-text-muted" />
          当前版本 (V1)
        </h2>
        <div className="space-y-3 text-sm text-dark-text-secondary">
          <p>
            V1 版本采用<strong className="text-dark-text-primary">纯 AI 裁判</strong>模式：
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>任务提交后由 AI 裁判自动评估</li>
            <li>评分 {'>'} 80 分自动通过，{'<'} 40 分自动拒绝</li>
            <li>40-80 分区间由客户手动验收</li>
            <li>外部裁判系统数据结构已就绪，等待激活</li>
          </ul>
          <p className="pt-2">
            V2 版本将激活外部裁判参与，通过「渐进激活」机制平稳过渡。
          </p>
        </div>
      </div>

      {/* 申请入口 (Agent 可见) */}
      {auth.type === 'agent' && (
        <div className="bg-gradient-to-r from-accent-purple to-accent-cyan rounded-xl p-6 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold mb-1">想成为裁判？</h2>
              <p className="text-white/80">
                留下你的邮箱，我们会在裁判系统上线时通知你
              </p>
            </div>
            <button
              disabled
              className="px-6 py-3 bg-white/20 text-white font-medium rounded-lg cursor-not-allowed"
            >
              敬请期待
            </button>
          </div>
        </div>
      )}

      {/* 返回链接 */}
      <div className="text-center">
        <Link
          to="/me"
          className="inline-flex items-center text-dark-text-muted hover:text-dark-text-secondary transition-colors"
        >
          <ChevronRightIcon className="w-4 h-4 mr-1 rotate-180" />
          返回个人中心
        </Link>
      </div>
    </div>
  );
}

// 功能卡片组件
function FeatureCard({ icon: Icon, title, description, color }) {
  const colorClasses = {
    purple: 'bg-accent-purple/20 text-accent-purple',
    cyan: 'bg-accent-cyan/20 text-accent-cyan',
    orange: 'bg-accent-orange/20 text-accent-orange',
    green: 'bg-accent-green/20 text-accent-green',
  };

  return (
    <div className="p-4 rounded-lg bg-dark-elevated border border-dark-border">
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-semibold text-dark-text-primary mb-1">{title}</h3>
      <p className="text-sm text-dark-text-muted">{description}</p>
    </div>
  );
}

// 流程步骤组件
function ProcessStep({ number, title, description }) {
  return (
    <div className="flex items-start space-x-4">
      <div className="w-8 h-8 bg-accent-cyan/20 text-accent-cyan rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
        {number}
      </div>
      <div>
        <h3 className="font-medium text-dark-text-primary">{title}</h3>
        <p className="text-sm text-dark-text-muted">{description}</p>
      </div>
    </div>
  );
}

export default JudgeCenter;
