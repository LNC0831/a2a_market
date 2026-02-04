/**
 * API 配置和请求封装
 *
 * 部署时通过环境变量配置 API 地址：
 * - 开发环境：REACT_APP_API_URL=http://localhost:3001
 * - 生产环境：REACT_APP_API_URL=https://api.yourdomain.com
 */

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// 存储认证信息
let authKey = localStorage.getItem('authKey') || null;
let authType = localStorage.getItem('authType') || null; // 'client' | 'agent'

/**
 * 设置认证信息
 */
export function setAuth(key, type) {
  authKey = key;
  authType = type;
  localStorage.setItem('authKey', key);
  localStorage.setItem('authType', type);
}

/**
 * 清除认证信息
 */
export function clearAuth() {
  authKey = null;
  authType = null;
  localStorage.removeItem('authKey');
  localStorage.removeItem('authType');
}

/**
 * 获取当前认证状态
 */
export function getAuth() {
  return { key: authKey, type: authType };
}

/**
 * 通用请求方法
 */
async function request(method, path, body = null) {
  const url = `${API_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
  };

  // 添加认证头
  if (authKey) {
    if (authType === 'client') {
      headers['X-Client-Key'] = authKey;
    } else if (authType === 'agent') {
      headers['X-Agent-Key'] = authKey;
    }
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// ==================== API 方法 ====================

export const api = {
  // 健康检查
  health: () => request('GET', '/api/health'),

  // 客户注册 (带密码和验证码)
  registerClient: (name, email, password, recaptchaToken) =>
    request('POST', '/api/hall/client/register', { name, email, password, recaptchaToken }),

  // 客户登录
  loginClient: (email, password, recaptchaToken) =>
    request('POST', '/api/hall/client/login', { email, password, recaptchaToken }),

  // Agent 获取注册挑战
  getAgentChallenge: () =>
    request('GET', '/api/hall/register/challenge'),

  // Agent 注册 (需要先完成挑战)
  registerAgent: (data) =>
    request('POST', '/api/hall/register', data),

  // 发布任务
  postTask: (data) =>
    request('POST', '/api/hall/post', data),

  // 获取任务大厅（开放任务）
  getOpenTasks: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request('GET', `/api/hall/tasks${query ? '?' + query : ''}`);
  },

  // 获取任务追踪详情
  trackTask: (taskId) =>
    request('GET', `/api/hall/track/${taskId}`),

  // 接单
  claimTask: (taskId) =>
    request('POST', `/api/hall/tasks/${taskId}/claim`),

  // 提交结果
  submitTask: (taskId, result, metadata = {}) =>
    request('POST', `/api/hall/tasks/${taskId}/submit`, { result, metadata }),

  // 验收通过
  acceptTask: (taskId) =>
    request('POST', `/api/hall/tasks/${taskId}/accept`),

  // 验收拒绝
  rejectTask: (taskId, reason) =>
    request('POST', `/api/hall/tasks/${taskId}/reject`, { reason }),

  // 评价
  rateTask: (taskId, rating, comment) =>
    request('POST', `/api/hall/tasks/${taskId}/rate`, { rating, comment }),

  // 取消任务
  cancelTask: (taskId) =>
    request('POST', `/api/hall/tasks/${taskId}/cancel`),

  // 我的订单（客户视角）
  getMyOrders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request('GET', `/api/hall/my-orders${query ? '?' + query : ''}`);
  },

  // 我的任务（Agent视角）
  getMyTasks: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request('GET', `/api/hall/my-tasks${query ? '?' + query : ''}`);
  },

  // Agent 收益
  getEarnings: () =>
    request('GET', '/api/hall/earnings'),

  // 平台统计
  getStats: () =>
    request('GET', '/api/stats'),

  // Agent 排行榜
  getLeaderboard: (sort = 'rating', limit = 10) =>
    request('GET', `/api/leaderboard?sort=${sort}&limit=${limit}`),

  // Agent 详情
  getAgentDetail: (agentId) =>
    request('GET', `/api/agents/${agentId}`),

  // ==================== 经济系统 API ====================

  // 获取经济状态 (σ, R, B 参数)
  getEconomyStatus: () =>
    request('GET', '/api/economy/status'),

  // 获取经济历史数据
  getEconomyHistory: (days = 30) =>
    request('GET', `/api/economy/history?days=${days}`),

  // 获取经济公式说明
  getEconomyFormula: () =>
    request('GET', '/api/economy/formula'),

  // 模拟结算预览
  simulateSettlement: (price) =>
    request('GET', `/api/economy/simulate?price=${price}`),

  // ==================== 钱包 API ====================

  // 获取所有钱包
  getWallets: () =>
    request('GET', '/api/wallet'),

  // 获取 MP 余额
  getMPBalance: () =>
    request('GET', '/api/wallet/MP/balance'),

  // 获取 MP 交易历史
  getMPHistory: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request('GET', `/api/wallet/MP/history${query ? '?' + query : ''}`);
  },

  // 获取 MP 统计
  getMPStats: () =>
    request('GET', '/api/wallet/MP/stats'),
};

export default api;
