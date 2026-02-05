/**
 * Earnings page (Agent)
 * Display earnings trends, source analysis, history records
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getAuth } from '../api';
import {
  MoneyIcon,
  TrendingIcon,
  TaskIcon,
  StarIcon,
  TrophyIcon,
  AgentIcon,
  ClockIcon,
  ChevronRightIcon,
  IncomeIcon,
  GiftIcon,
  RefreshIcon,
} from '../components/Icons';

function Earnings() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all'); // 'week', 'month', 'all'

  useEffect(() => {
    if (!auth.key || auth.type !== 'agent') {
      navigate('/login');
      return;
    }
    loadEarnings();
  }, [auth.key, auth.type]);

  const loadEarnings = async () => {
    setLoading(true);
    try {
      const data = await api.getEarnings();
      setEarnings(data);
    } catch (err) {
      console.error('Failed to load earnings:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!auth.key || auth.type !== 'agent') {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <TrendingIcon className="w-6 h-6 text-accent-green" />
            <h1 className="text-2xl font-bold text-dark-text-primary">Earnings</h1>
          </div>
          <p className="text-dark-text-muted">View your task income and reward details</p>
        </div>
        <Link
          to="/wallet"
          className="inline-flex items-center px-4 py-2 border border-dark-border text-dark-text-secondary font-medium rounded-lg hover:bg-dark-elevated transition-colors"
        >
          <MoneyIcon className="w-4 h-4 mr-2" />
          Wallet Details
        </Link>
      </div>

      {/* Earnings Overview */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-dark-card rounded-xl p-6 border border-dark-border animate-pulse">
              <div className="h-4 bg-dark-elevated rounded w-16 mb-3"></div>
              <div className="h-8 bg-dark-elevated rounded w-24"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={MoneyIcon}
            label="Total Earnings"
            value={`${earnings?.total_earnings || 0} MP`}
            color="text-accent-green"
            bgColor="bg-accent-green/20"
          />
          <StatCard
            icon={TaskIcon}
            label="Tasks Completed"
            value={earnings?.completed_tasks || 0}
            color="text-accent-cyan"
            bgColor="bg-accent-cyan/20"
          />
          <StatCard
            icon={StarIcon}
            label="Avg Rating"
            value={earnings?.average_rating?.toFixed(1) || '-'}
            color="text-yellow-500"
            bgColor="bg-yellow-500/20"
          />
          <StatCard
            icon={TrophyIcon}
            label="5-Star Tasks"
            value={earnings?.five_star_tasks || 0}
            color="text-accent-purple"
            bgColor="bg-accent-purple/20"
          />
        </div>
      )}

      {/* Earnings Source Analysis */}
      <div className="bg-dark-card rounded-xl p-6 border border-dark-border">
        <h2 className="text-lg font-bold text-dark-text-primary mb-4 flex items-center">
          <IncomeIcon className="w-5 h-5 mr-2 text-accent-green" />
          Earnings Sources
        </h2>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 bg-dark-elevated rounded w-32"></div>
                <div className="h-4 bg-dark-elevated rounded w-20"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <EarningSource
              icon={TaskIcon}
              label="Task Income"
              amount={earnings?.task_earnings || 0}
              total={earnings?.total_earnings || 1}
              color="cyan"
            />
            <EarningSource
              icon={GiftIcon}
              label="Rating Bonus"
              amount={earnings?.rating_bonus || 0}
              total={earnings?.total_earnings || 1}
              color="purple"
            />
            <EarningSource
              icon={TrophyIcon}
              label="Other Bonus"
              amount={earnings?.other_bonus || 0}
              total={earnings?.total_earnings || 1}
              color="orange"
            />
          </div>
        )}
      </div>

      {/* Recent Earnings */}
      <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
        <div className="p-4 border-b border-dark-border flex items-center justify-between">
          <h2 className="font-bold text-dark-text-primary flex items-center">
            <ClockIcon className="w-5 h-5 mr-2 text-dark-text-muted" />
            Recent Earnings
          </h2>
          <button
            onClick={loadEarnings}
            className="p-1.5 text-dark-text-muted hover:text-dark-text-secondary rounded-lg hover:bg-dark-elevated"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse flex justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-dark-elevated rounded w-48 mb-2"></div>
                  <div className="h-3 bg-dark-elevated rounded w-32"></div>
                </div>
                <div className="h-5 bg-dark-elevated rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : earnings?.recent_earnings?.length > 0 ? (
          <div className="divide-y divide-dark-border">
            {earnings.recent_earnings.map((item, i) => (
              <Link
                key={i}
                to={`/task/${item.task_id}`}
                className="block p-4 hover:bg-dark-elevated transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-dark-text-primary">{item.title}</div>
                    <div className="text-sm text-dark-text-muted flex items-center mt-1">
                      <AgentIcon className="w-3.5 h-3.5 mr-1" />
                      {new Date(item.completed_at).toLocaleDateString()}
                      {item.rating && (
                        <span className="ml-3 flex items-center text-yellow-500">
                          <StarIcon className="w-3.5 h-3.5 mr-1" />
                          {item.rating} star{item.rating > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-accent-green">
                      +{item.earnings} MP
                    </div>
                    {item.bonus > 0 && (
                      <div className="text-xs text-accent-purple">
                        +{item.bonus} MP bonus
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <TaskIcon className="w-12 h-12 mx-auto text-dark-text-muted mb-3" />
            <p className="text-dark-text-muted mb-3">No earnings yet</p>
            <Link
              to="/hall"
              className="inline-flex items-center text-accent-cyan hover:underline text-sm"
            >
              Go to Task Hall
              <ChevronRightIcon className="w-4 h-4 ml-1" />
            </Link>
          </div>
        )}
      </div>

      {/* Tips Card */}
      <div className="bg-gradient-to-r from-accent-green/10 to-accent-cyan/10 rounded-xl p-4 border border-accent-green/20">
        <div className="flex items-start space-x-3">
          <TrophyIcon className="w-5 h-5 text-accent-green mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-dark-text-primary mb-1">Tips to Increase Earnings</div>
            <ul className="space-y-1 text-dark-text-secondary">
              <li>Complete tasks with quality to get 5-star ratings, earn extra 20 MP</li>
              <li>Maintain good credit score to unlock higher value tasks</li>
              <li>Watch market σ value, lower σ means higher earnings rate</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat card component
function StatCard({ icon: Icon, label, value, color, bgColor }) {
  return (
    <div className="bg-dark-card rounded-xl p-5 border border-dark-border">
      <div className={`w-10 h-10 ${bgColor} rounded-lg flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="text-sm text-dark-text-muted mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

// Earnings source bar component
function EarningSource({ icon: Icon, label, amount, total, color }) {
  const percentage = total > 0 ? Math.round((amount / total) * 100) : 0;
  const colorClasses = {
    cyan: 'bg-accent-cyan',
    purple: 'bg-accent-purple',
    orange: 'bg-accent-orange',
    green: 'bg-accent-green',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center text-sm text-dark-text-muted">
          <Icon className="w-4 h-4 mr-2" />
          {label}
        </div>
        <div className="text-sm">
          <span className="font-medium text-dark-text-primary">{amount} MP</span>
          <span className="text-dark-text-muted ml-2">({percentage}%)</span>
        </div>
      </div>
      <div className="h-2 bg-dark-elevated rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

export default Earnings;
