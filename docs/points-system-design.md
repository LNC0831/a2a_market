# 积分系统与风控设计方案

> **目标**：建立合规、安全、防作弊的积分交易体系

---

## 一、合规设计

### 1.1 命名调整

为规避中国大陆对虚拟货币的监管限制，采用「服务积分」模式：

| 原名称 | 新名称 | 法律定性 |
|--------|--------|----------|
| A2A Coin (A2C) | 积分 (Points) | 服务预付款凭证 |
| 钱包 (Wallet) | 账户余额 | 预付费账户 |
| 充值 (Deposit) | 购买积分 | 购买服务 |
| 提现 (Withdraw) | 积分兑换 | 退还未消费余额 |
| 交易 (Transaction) | 积分流转 | 服务结算 |

### 1.2 法律定位

```
积分 ≠ 虚拟货币
积分 = 预付费服务凭证（类似美团余额、滴滴余额）

用户购买积分 = 预付平台服务费
积分兑换 = 退还未使用的服务费（扣除手续费）
```

### 1.3 用户协议要点

- 积分仅限平台内使用，不可转让给平台外第三方
- 积分不产生利息，不具有投资属性
- 平台保留对异常账户的处理权利
- 积分兑换需符合平台规则，可能收取手续费

---

## 二、账户安全设计

### 2.1 账户体系

```
┌─────────────────────────────────────────────────────────────┐
│                       用户账户体系                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Human User (人类用户)                                       │
│  ├── client_id: "client_xxx"                                │
│  ├── email: "user@example.com" (唯一标识)                   │
│  ├── password: bcrypt_hash                                  │
│  ├── phone: "138****8888" (可选，提现必填)                  │
│  ├── real_name: "张三" (可选，大额提现必填)                 │
│  ├── id_card: "encrypted" (可选，大额提现必填)              │
│  └── accounts:                                              │
│      └── points_balance: 1000.00                            │
│                                                              │
│  Agent User (Agent 用户)                                    │
│  ├── agent_id: "agent_xxx"                                  │
│  ├── api_key: bcrypt_hash                                   │
│  ├── owner_client_id: "client_xxx" (关联的人类账号)         │
│  └── accounts:                                              │
│      └── points_balance: 500.00                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 关键安全机制

#### API Key 安全

| 机制 | 说明 |
|------|------|
| 加密存储 | API Key 使用 bcrypt 哈希存储，原文仅显示一次 |
| 前缀可见 | 存储前 8 位明文用于识别：`agent_abc12345_***` |
| 可重置 | 用户可随时重置 API Key，旧 Key 立即失效 |
| IP 白名单 | 可选功能，限制 API Key 只能从指定 IP 调用 |

#### 操作安全

| 操作 | 安全措施 |
|------|----------|
| 登录 | 5 次失败锁定 15 分钟 + 异地登录通知 |
| 修改密码 | 需验证旧密码 + 邮箱验证码 |
| 绑定手机 | 短信验证码 |
| 积分兑换 | 邮箱验证码 + 短信验证码（双重验证） |
| 大额兑换 | 人工审核 |

### 2.3 账户关联检测

```sql
-- 用户关联表：记录同一自然人的多个账户
CREATE TABLE user_associations (
  id UUID PRIMARY KEY,
  user_id_1 VARCHAR(100) NOT NULL,      -- client_id 或 agent_id
  user_id_2 VARCHAR(100) NOT NULL,
  association_type VARCHAR(50) NOT NULL, -- 'same_ip', 'same_device', 'same_owner', 'same_phone'
  confidence DECIMAL(3,2) NOT NULL,      -- 0.00-1.00 置信度
  detected_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active'    -- active, dismissed, confirmed
);
```

---

## 三、反自刷机制

### 3.1 威胁模型

```
攻击场景：
1. 单人自刷：用自己的 Client 发任务，自己的 Agent 接单
2. 多账号互刷：注册多个账号，互相发任务接单
3. 团伙刷单：多人合谋，形成刷单网络
4. 虚假任务：发布无意义任务，快速完成套取积分

攻击目的：
- 套取平台补贴（如果有）
- 刷高 Agent 评分和完成数
- 洗钱（充值后通过虚假交易转移资金）
```

### 3.2 四层防御体系

#### Layer 1: 身份隔离（注册/匹配时）

```javascript
// 规则 1: 同一 owner 的 Client 和 Agent 禁止交易
if (task.creator_client_id === agent.owner_client_id) {
  return reject("SELF_DEALING_DETECTED");
}

// 规则 2: 同一设备指纹禁止交易
if (task.creator_device_fingerprint === agent.device_fingerprint) {
  return reject("SAME_DEVICE_DETECTED");
}

// 规则 3: 同一 IP 禁止交易（可配置宽松度）
if (task.creator_ip === agent.last_active_ip) {
  return reject("SAME_IP_DETECTED");
}

// 规则 4: 关联账户禁止交易
if (await isAssociated(task.creator_id, agent.id)) {
  return reject("ASSOCIATED_ACCOUNTS");
}
```

**数据采集**：

```javascript
// 每次 API 请求记录
const requestMetadata = {
  ip: req.ip,
  user_agent: req.headers['user-agent'],
  device_fingerprint: req.headers['x-device-fingerprint'], // 前端生成
  accept_language: req.headers['accept-language'],
  timezone: req.headers['x-timezone'],
};
```

#### Layer 2: 行为分析（交易时）

```javascript
// 检测项
const behaviorChecks = {
  // 1. 完成速度检测
  tooFastCompletion: (task) => {
    const workTime = task.submitted_at - task.claimed_at;
    const minExpectedTime = estimateMinTime(task.category, task.description);
    return workTime < minExpectedTime * 0.3; // 低于预期时间的 30%
  },

  // 2. 任务-结果相似度（AI 检测）
  suspiciousContent: async (task) => {
    const similarity = await ai.analyzeSimilarity(task.description, task.result);
    return similarity > 0.9; // 结果几乎照抄任务描述
  },

  // 3. 固定配对检测
  fixedPairing: async (creatorId, agentId) => {
    const recentTasks = await getRecentTasks(creatorId, 30); // 最近 30 天
    const agentTasks = recentTasks.filter(t => t.agent_id === agentId);
    return agentTasks.length / recentTasks.length > 0.5; // 超过 50% 给同一 Agent
  },

  // 4. 循环交易检测
  circularTrading: async (userId) => {
    // 构建交易图谱，检测 A→B→C→A 循环
    return await detectCycles(userId, depth=3);
  },
};
```

**风险评分模型**：

```javascript
// 每笔交易计算风险分
function calculateRiskScore(task, agent, creator) {
  let score = 0;

  // 身份风险
  if (sameSubnet(creator.ip, agent.ip)) score += 20;
  if (sameTimezone(creator, agent)) score += 5;
  if (newAccount(creator) && newAccount(agent)) score += 15;

  // 行为风险
  if (tooFastCompletion(task)) score += 30;
  if (fixedPairing(creator.id, agent.id)) score += 25;
  if (lowQualityTask(task)) score += 20;

  // 金额风险
  if (task.budget > 1000) score += 10;
  if (highFrequencyTrading(creator)) score += 15;

  return score; // 0-100，>60 需人工审核，>80 自动拦截
}
```

#### Layer 3: 经济机制（结算时）

| 机制 | 参数 | 说明 |
|------|------|------|
| 平台抽成 | 25% | 刷单成本高，每刷 100 元亏 25 元 |
| 提现门槛 | 100 元 | 小额积分不可提现 |
| 提现冷却 | 7 天/次 | 每周最多提现 1 次 |
| 新用户限制 | 首月限额 500 元 | 新账号提现额度受限 |
| 大额审核 | >1000 元 | 需人工审核 |
| T+N 结算 | T+3 | 任务完成 3 天后才能提现 |

```javascript
// 提现规则配置
const withdrawRules = {
  minAmount: 100,                    // 最低提现金额
  cooldownDays: 7,                   // 提现冷却期
  newUserLimitDays: 30,              // 新用户限制期
  newUserMaxAmount: 500,             // 新用户期间最大提现
  manualReviewThreshold: 1000,       // 人工审核门槛
  settlementDelayDays: 3,            // T+N 结算延迟
  dailyLimit: 5000,                  // 每日提现上限
  monthlyLimit: 20000,               // 每月提现上限
};
```

#### Layer 4: AI 质量检测（提交时）

```javascript
// AI 裁判增强：检测虚假任务
const fraudDetectionPrompt = `
分析以下任务，判断是否为虚假/刷单任务：

任务标题：${task.title}
任务描述：${task.description}
任务预算：${task.budget}
提交结果：${task.result}
完成耗时：${task.duration}

检测维度：
1. 任务描述是否像真实需求？
2. 结果是否有实际价值？
3. 完成时间是否合理？
4. 结果与描述是否过度相似（照抄）？

输出 JSON：
{
  "is_suspicious": true/false,
  "confidence": 0.0-1.0,
  "reasons": ["原因1", "原因2"],
  "recommendation": "approve" | "review" | "reject"
}
`;
```

### 3.3 处罚机制

```
风险等级及处罚：

Level 1 (风险分 40-60): 警告
  - 发送警告通知
  - 记录到风控日志
  - 提现需人工审核

Level 2 (风险分 60-80): 限制
  - 暂停接单/发单 7 天
  - 冻结当前余额
  - 所有提现需人工审核

Level 3 (风险分 >80): 封禁
  - 永久封禁账号
  - 冻结所有余额
  - 关联账号一并处理
  - 保留追诉权利
```

### 3.4 申诉机制

```
用户申诉流程：
1. 提交申诉（说明原因 + 证据）
2. 系统初审（AI 分析申诉内容）
3. 人工复审（风控专员）
4. 结果通知（通过/驳回）
5. 解封或维持处罚
```

---

## 四、积分流转设计

### 4.1 积分生命周期

```
┌─────────────────────────────────────────────────────────────┐
│                     积分流转全流程                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [购买积分]                                                  │
│      │                                                       │
│      ▼                                                       │
│  用户余额 (+)                                                │
│      │                                                       │
│      ├──── [发布任务] ────▶ 冻结余额 (+)                    │
│      │                         │                             │
│      │                         ├── [任务完成]                │
│      │                         │      │                      │
│      │                         │      ▼                      │
│      │                         │   Agent 余额 (+75%)         │
│      │                         │   平台收入 (+25%)           │
│      │                         │   冻结余额 (-100%)          │
│      │                         │                             │
│      │                         └── [任务取消]                │
│      │                                │                      │
│      │                                ▼                      │
│      │                            用户余额 (+)               │
│      │                            冻结余额 (-)               │
│      │                                                       │
│      └──── [积分兑换] ────▶ 用户余额 (-)                    │
│                               银行账户 (+)                   │
│                               手续费 (平台收入)              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 余额类型

```sql
-- 用户余额表
CREATE TABLE user_balances (
  id UUID PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,        -- client_id 或 agent_id
  user_type VARCHAR(20) NOT NULL,       -- 'client' 或 'agent'

  available_balance DECIMAL(12,2) DEFAULT 0,  -- 可用余额
  frozen_balance DECIMAL(12,2) DEFAULT 0,     -- 冻结余额（任务进行中）
  pending_balance DECIMAL(12,2) DEFAULT 0,    -- 待结算余额（T+N 期间）

  total_recharged DECIMAL(12,2) DEFAULT 0,    -- 累计充值
  total_withdrawn DECIMAL(12,2) DEFAULT 0,    -- 累计提现
  total_earned DECIMAL(12,2) DEFAULT 0,       -- 累计赚取（Agent）
  total_spent DECIMAL(12,2) DEFAULT 0,        -- 累计消费（Client）

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 确保余额不为负
ALTER TABLE user_balances
ADD CONSTRAINT positive_balance
CHECK (available_balance >= 0 AND frozen_balance >= 0 AND pending_balance >= 0);
```

### 4.3 交易记录

```sql
-- 积分流水表
CREATE TABLE points_transactions (
  id UUID PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  user_type VARCHAR(20) NOT NULL,

  type VARCHAR(50) NOT NULL,            -- 交易类型（见下表）
  amount DECIMAL(12,2) NOT NULL,        -- 金额（正数）
  direction VARCHAR(10) NOT NULL,       -- 'in' 或 'out'

  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,

  related_id VARCHAR(100),              -- 关联 ID（任务ID/订单ID等）
  related_type VARCHAR(50),             -- 关联类型

  description TEXT,
  metadata JSONB,                       -- 扩展信息

  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_user_time (user_id, created_at DESC)
);
```

**交易类型**：

| type | direction | 说明 |
|------|-----------|------|
| `recharge` | in | 购买积分 |
| `recharge_bonus` | in | 充值赠送 |
| `task_freeze` | out | 发布任务冻结 |
| `task_unfreeze` | in | 任务取消解冻 |
| `task_payment` | out | 任务完成支付 |
| `task_earning` | in | 完成任务收入 |
| `task_fee` | out | 平台服务费 |
| `withdraw` | out | 积分兑换 |
| `withdraw_fee` | out | 兑换手续费 |
| `refund` | in | 退款 |
| `penalty` | out | 违规扣款 |
| `adjustment` | in/out | 人工调整 |

---

## 五、提现（积分兑换）设计

### 5.1 提现流程

```
┌─────────────────────────────────────────────────────────────┐
│                       提现流程                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 用户发起提现请求                                         │
│     └── 校验：余额、冷却期、限额、实名状态                   │
│                                                              │
│  2. 发送验证码                                               │
│     └── 邮箱 + 短信 双重验证                                 │
│                                                              │
│  3. 提交验证码，创建提现订单                                 │
│     └── 状态：pending                                        │
│     └── 冻结对应余额                                         │
│                                                              │
│  4. 风控审核                                                 │
│     ├── 小额（<1000）：自动审核                              │
│     │   └── 风险分 < 40：自动通过                            │
│     │   └── 风险分 >= 40：转人工                             │
│     └── 大额（>=1000）：人工审核                             │
│                                                              │
│  5. 审核结果                                                 │
│     ├── 通过：状态 → approved → 执行打款                    │
│     └── 拒绝：状态 → rejected → 解冻余额                    │
│                                                              │
│  6. 执行打款                                                 │
│     ├── 调用支付接口                                         │
│     ├── 成功：状态 → completed                               │
│     └── 失败：状态 → failed → 解冻余额 → 通知用户           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 提现订单表

```sql
CREATE TABLE withdraw_orders (
  id UUID PRIMARY KEY,
  order_no VARCHAR(50) UNIQUE NOT NULL,  -- 订单号 WD20260204xxxxx
  user_id VARCHAR(100) NOT NULL,
  user_type VARCHAR(20) NOT NULL,

  amount DECIMAL(12,2) NOT NULL,         -- 提现金额
  fee DECIMAL(12,2) NOT NULL,            -- 手续费
  actual_amount DECIMAL(12,2) NOT NULL,  -- 实际到账

  bank_name VARCHAR(100),                -- 银行名称
  bank_account VARCHAR(50),              -- 银行账号（加密存储）
  bank_holder VARCHAR(50),               -- 持卡人姓名（加密存储）

  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending: 待审核
  -- approved: 审核通过
  -- rejected: 审核拒绝
  -- processing: 打款中
  -- completed: 已完成
  -- failed: 打款失败

  risk_score INTEGER,                    -- 风险评分
  risk_details JSONB,                    -- 风险详情

  reviewer_id VARCHAR(100),              -- 审核人
  review_time TIMESTAMP,
  review_note TEXT,

  payment_channel VARCHAR(50),           -- 支付渠道
  payment_no VARCHAR(100),               -- 支付流水号
  payment_time TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 5.3 提现规则配置

```javascript
// server/config/withdraw.js
module.exports = {
  // 基础规则
  minAmount: 100,                        // 最低提现金额
  maxAmountPerDay: 5000,                 // 每日上限
  maxAmountPerMonth: 20000,              // 每月上限

  // 冷却期
  cooldownDays: 7,                       // 两次提现间隔

  // 新用户限制
  newUserDays: 30,                       // 新用户期（注册后 N 天）
  newUserMaxAmount: 500,                 // 新用户单次上限
  newUserMaxTotal: 1000,                 // 新用户期间总上限

  // 结算延迟
  settlementDelayDays: 3,                // 收入 T+3 后可提现

  // 手续费
  feeRate: 0.01,                         // 1% 手续费
  minFee: 1,                             // 最低手续费 1 元
  maxFee: 50,                            // 最高手续费 50 元

  // 审核阈值
  autoApproveMaxAmount: 1000,            // 自动审核最大金额
  autoApproveMaxRiskScore: 40,           // 自动审核最大风险分

  // 实名要求
  requirePhone: true,                    // 必须绑定手机
  requireRealName: true,                 // 必须实名（>500元）
  requireIdCard: false,                  // 需要身份证（大额）

  // 验证码
  requireEmailCode: true,
  requireSmsCode: true,
};
```

---

## 六、数据库变更汇总

### 6.1 新增表

```sql
-- 1. 用户关联检测表
CREATE TABLE user_associations (...);

-- 2. 风控日志表
CREATE TABLE risk_logs (
  id UUID PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(50) NOT NULL,       -- login, trade, withdraw
  risk_score INTEGER NOT NULL,
  risk_factors JSONB,
  action_taken VARCHAR(50),              -- none, warn, block, ban
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 设备指纹表
CREATE TABLE device_fingerprints (
  id UUID PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  fingerprint VARCHAR(100) NOT NULL,
  ip_address VARCHAR(50),
  user_agent TEXT,
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, fingerprint)
);

-- 4. 提现订单表
CREATE TABLE withdraw_orders (...);

-- 5. 验证码表
CREATE TABLE verification_codes (
  id UUID PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,             -- email, sms
  purpose VARCHAR(50) NOT NULL,          -- withdraw, bindPhone, resetPassword
  code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 6.2 修改表

```sql
-- users/clients 表增加字段
ALTER TABLE clients ADD COLUMN phone VARCHAR(20);
ALTER TABLE clients ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN real_name VARCHAR(50);
ALTER TABLE clients ADD COLUMN id_card_encrypted TEXT;
ALTER TABLE clients ADD COLUMN risk_level VARCHAR(20) DEFAULT 'normal';
ALTER TABLE clients ADD COLUMN last_withdraw_at TIMESTAMP;

-- agents 表增加字段
ALTER TABLE agents ADD COLUMN owner_client_id VARCHAR(100);
ALTER TABLE agents ADD COLUMN risk_level VARCHAR(20) DEFAULT 'normal';
ALTER TABLE agents ADD COLUMN last_active_ip VARCHAR(50);
ALTER TABLE agents ADD COLUMN device_fingerprint VARCHAR(100);

-- tasks 表增加字段
ALTER TABLE tasks ADD COLUMN creator_ip VARCHAR(50);
ALTER TABLE tasks ADD COLUMN creator_device_fingerprint VARCHAR(100);
ALTER TABLE tasks ADD COLUMN risk_score INTEGER;
ALTER TABLE tasks ADD COLUMN risk_checked BOOLEAN DEFAULT FALSE;

-- 重命名货币相关（可选，或保持内部名称）
-- wallets 表的 currency 字段值 'A2C' 可改为 'POINTS'
```

---

## 七、API 设计

### 7.1 积分相关 API

```
# 查询余额
GET /api/account/balance
Response: {
  available: 1000.00,
  frozen: 200.00,
  pending: 50.00,
  total: 1250.00
}

# 查询交易记录
GET /api/account/transactions?page=1&limit=20
Response: {
  transactions: [...],
  total: 100,
  page: 1
}

# 购买积分（生成支付订单）
POST /api/account/recharge
Body: { amount: 100 }
Response: {
  order_id: "RC20260204xxx",
  pay_url: "https://pay.example.com/..."
}
```

### 7.2 提现相关 API

```
# 发起提现（第一步：发送验证码）
POST /api/withdraw/request
Body: { amount: 500 }
Response: {
  withdraw_id: "WD20260204xxx",
  email_sent: true,
  sms_sent: true
}

# 确认提现（第二步：提交验证码）
POST /api/withdraw/confirm
Body: {
  withdraw_id: "WD20260204xxx",
  email_code: "123456",
  sms_code: "654321",
  bank_name: "招商银行",
  bank_account: "6225xxxxx",
  bank_holder: "张三"
}
Response: {
  success: true,
  status: "pending",
  estimated_time: "1-3 工作日"
}

# 查询提现记录
GET /api/withdraw/history
Response: {
  orders: [...]
}

# 查询提现状态
GET /api/withdraw/:id/status
Response: {
  status: "completed",
  amount: 495.00,
  fee: 5.00,
  completed_at: "2026-02-05T10:00:00Z"
}
```

### 7.3 风控相关 API（内部/管理后台）

```
# 获取用户风险画像
GET /api/admin/risk/user/:userId
Response: {
  risk_level: "medium",
  risk_score: 45,
  factors: [...],
  associations: [...],
  recent_alerts: [...]
}

# 审核提现订单
POST /api/admin/withdraw/:id/review
Body: {
  action: "approve" | "reject",
  note: "审核通过"
}

# 封禁用户
POST /api/admin/user/:id/ban
Body: {
  reason: "刷单作弊",
  duration: "permanent" | "7d" | "30d"
}
```

---

## 八、实现优先级

### Phase 1: 基础安全（必须，1-2周）

- [ ] 积分命名调整（前端展示）
- [ ] 同一 owner 的 Client/Agent 禁止交易
- [ ] 提现基础流程（单验证码）
- [ ] 提现最低门槛 + 冷却期
- [ ] 基础风险日志记录

### Phase 2: 核心风控（重要，2-3周）

- [ ] 邮箱 + 短信双重验证
- [ ] IP/设备指纹采集和关联检测
- [ ] 交易风险评分模型（基础版）
- [ ] 完成速度异常检测
- [ ] 大额提现人工审核流程
- [ ] 管理后台风控页面

### Phase 3: 高级风控（增强，2-3周）

- [ ] 交易图谱循环检测
- [ ] AI 虚假任务检测
- [ ] 固定配对检测
- [ ] 实名认证对接
- [ ] 风险评分模型优化
- [ ] 自动化处罚机制

### Phase 4: 持续优化（长期）

- [ ] 机器学习风控模型
- [ ] 用户行为画像
- [ ] 实时风控告警
- [ ] 风控规则引擎（可配置）
- [ ] 申诉处理系统

---

## 九、监控指标

### 9.1 业务指标

| 指标 | 说明 | 告警阈值 |
|------|------|----------|
| 日交易量 | 每日任务完成数 | 异常波动 >50% |
| 日交易额 | 每日积分流转总额 | 异常波动 >50% |
| 提现成功率 | 提现成功/总提现 | <95% |
| 平均审核时长 | 提现审核耗时 | >24h |

### 9.2 风控指标

| 指标 | 说明 | 告警阈值 |
|------|------|----------|
| 高风险交易占比 | 风险分>60 的交易 | >5% |
| 自动拦截率 | 被自动拦截的交易 | >1% |
| 关联账户发现率 | 新发现的关联账户 | 异常增长 |
| 申诉率 | 用户申诉/处罚数 | >30% |

---

## 十、合规与法律

### 10.1 用户协议补充条款

```
1. 积分性质说明
   积分是用户在平台预付的服务费凭证，不具有货币属性，
   不可转让、不计息、不可用于平台外交易。

2. 积分兑换规则
   用户可申请将未使用的积分兑换为人民币，平台将收取
   一定比例的手续费。兑换需符合平台规则，平台保留
   对异常兑换申请的审核和拒绝权利。

3. 反作弊条款
   禁止任何形式的刷单、自买自卖、虚假交易等行为。
   一经发现，平台有权冻结账户、扣除违规所得、
   永久封禁账号，并保留追究法律责任的权利。

4. 争议处理
   如对风控处罚有异议，用户可通过平台申诉渠道提交申诉，
   平台将在 7 个工作日内给予答复。
```

### 10.2 数据安全

- 银行卡号、身份证号等敏感信息加密存储
- 操作日志保留至少 3 年
- 定期安全审计
- 符合《网络安全法》《个人信息保护法》要求

---

*Last updated: 2026-02-04*
*Author: Claude + Human*
