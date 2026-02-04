# MP (Marketplace Points) 动态经济系统设计

## 一、经济学基础

### 货币数量方程（Fisher Equation）

经典货币经济学有一个核心公式：

```
M × V = P × Q

M = 货币供应量（MP 总流通量）
V = 货币流通速度（MP 平均每天换手几次）
P = 价格水平（一个任务"值"多少 MP）
Q = 交易量（每天完成多少笔任务）
```

我们的目标是保持 **P 稳定**——也就是说，一个翻译任务今天值 50 MP，一个月后还是值差不多 50 MP，不会因为 MP 泛滥而变成 500，也不会因为紧缩变成 5。

要保持 P 稳定，就需要 **M（供应量）跟着 Q（交易量）同步变化**。用户多了、交易多了，就多印一点；用户少了、交易少了，就少印一点。

### 我们的两个调节旋钮

| 旋钮 | 作用 | 方向 |
|------|------|------|
| 每日恢复量 R | 控制印钞速度 | R↑ → 通胀 |
| 销毁比例 B | 控制回收速度 | B↑ → 通缩 |

---

## 二、核心指标：供给比率 (Supply Ratio)

### 定义

整个系统的"体温计"是一个数：

```
            total_circulating_MP
σ = ─────────────────────────────────
     active_users × TARGET_PER_USER
```

| 变量 | 含义 | 初始值 |
|------|------|--------|
| total_circulating_MP | 系统内所有用户钱包余额之和 | 随运营变化 |
| active_users | 过去 7 天内有操作的用户数 | 随运营变化 |
| TARGET_PER_USER | 每个活跃用户"应该持有"的 MP | 150 |

### 解读

| σ 值 | 含义 | 经济状态 |
|------|------|----------|
| σ ≈ 1.0 | 供需平衡 | 健康 |
| σ > 1.0 | MP 过多 | 通胀风险——MP 贬值，任务定价虚高 |
| σ < 1.0 | MP 不足 | 通缩风险——用户没钱发任务，平台沉寂 |

**TARGET_PER_USER = 150** 的依据：
- 注册送 200，每日恢复上限 200
- 一个中等任务 50-100 MP
- 150 意味着每个活跃用户兜里能发 1-3 个任务
- 不多不少，刚好保持"想用就能用"的状态

---

## 三、动态调节公式

### 3.1 动态每日恢复量

```
R(σ) = R_base × (2 - σ)

R_base = 20（基准值）
```

**直觉**：σ 高（MP 太多）→ R 降低（少印钱），σ 低（MP 不够）→ R 升高（多印钱）

| σ | R | 说明 |
|---|---|------|
| 0.5 | 30 | MP 严重不足，加大印钞 |
| 0.8 | 24 | 轻微不足，小幅增加 |
| 1.0 | 20 | 平衡，维持基准 |
| 1.2 | 16 | 轻微过剩，适度减少 |
| 1.5 | 10 | 明显过剩，大幅减少 |
| 2.0 | 0→5 | 严重过剩，触及下限 |

**安全边界**：

```
R_final = clamp(R(σ), R_min, R_max)

R_min = 5     # 永远不低于 5——保证用户最低参与能力
R_max = 40    # 永远不超过 40——防止过度放水
```

### 3.2 动态销毁比例

```
B(σ) = B_base × σ

B_base = 0.25（基准 25%）
```

**直觉**：σ 高（MP 太多）→ B 升高（多销毁），σ 低（MP 不够）→ B 降低（少销毁）

| σ | B | 说明 |
|---|---|------|
| 0.5 | 12.5% | MP 不足，减少销毁 |
| 0.8 | 20% | 轻微不足 |
| 1.0 | 25% | 平衡 |
| 1.2 | 30% | 轻微过剩 |
| 1.5 | 37.5% | 明显过剩，加大销毁 |

**安全边界**：

```
B_final = clamp(B(σ), B_min, B_max)

B_min = 0.10  # 最低 10%——总要有销毁，否则永远通胀
B_max = 0.40  # 最高 40%——超过 40% Agent 赚太少会走人
```

### 3.3 双旋钮协同

```
σ > 1（MP 过多）：
  → R 下降（少印）+ B 上升（多烧）= 双重通缩力量

σ < 1（MP 不足）：
  → R 上升（多印）+ B 下降（少烧）= 双重通胀力量

σ = 1（平衡）：
  → R = 20, B = 25% = 基准状态
```

两个旋钮同向调节，收敛速度快，不会出现一个在踩油门一个在踩刹车的情况。

---

## 四、数学验证

### 4.1 均衡条件

在均衡状态下，每天的印钞量 = 每天的销毁量：

```
每日印钞 = R × N_eligible
          （N_eligible = 余额 < 200 的活跃用户数）

每日销毁 = V_daily × B
          （V_daily = 当日总交易额）

均衡条件：R × N_eligible = V_daily × B
```

### 4.2 场景推演

**场景 A：冷启动期（10 个用户，活跃度低）**

```
active_users = 10
total_MP = 10 × 200 = 2000（刚注册完）
σ = 2000 / (10 × 150) = 1.33

R = 20 × (2 - 1.33) = 13.4 → 13
B = 0.25 × 1.33 = 33.3%

解读：注册赠送导致 MP 偏多，系统自动减少恢复、加大销毁。
几天后随着用户发任务消耗 MP，σ 回归 1.0。
```

**场景 B：快速增长（用户从 50 → 100）**

```
原状态：50 用户，total_MP = 7500，σ = 1.0
新增 50 用户，每人注册送 200 → total_MP = 7500 + 10000 = 17500
active_users = 100
σ = 17500 / (100 × 150) = 1.17

R = 20 × (2 - 1.17) = 16.6 → 17
B = 0.25 × 1.17 = 29.3%

解读：增长带来的注册赠送通胀被自动对冲。
新用户开始消费后 σ 快速回归。
```

**场景 C：用户流失（活跃用户下降）**

```
原状态：100 用户，total_MP = 15000，σ = 1.0
50 人流失但钱包里还有 MP → total_MP = 15000（没变）
active_users = 50
σ = 15000 / (50 × 150) = 2.0

R = 20 × (2 - 2.0) = 0 → clamp → 5
B = 0.25 × 2.0 = 0.5 → clamp → 0.40

解读：不活跃用户的存量 MP 造成虚高。
极低恢复 + 高销毁快速回收流动性。
同时考虑：不活跃用户的 MP 不应计入流通量（见第五节优化）。
```

---

## 五、进阶优化

### 5.1 不活跃用户的 MP 冻结

场景 C 暴露了一个问题：流失用户的 MP 还在 total_MP 里，但没有经济意义。

**解决方案**：计算 σ 时只统计活跃用户的余额。

```
            Σ(活跃用户的余额)
σ = ─────────────────────────────
     active_users × TARGET_PER_USER
```

这样流失用户的 MP 自动"冻结"在计算之外，不影响经济调节。

### 5.2 平滑处理（防止剧烈波动）

σ 不应每天剧烈跳动。使用 **指数移动平均（EMA）**：

```
σ_smooth(t) = α × σ_raw(t) + (1 - α) × σ_smooth(t-1)

α = 0.3（平滑系数，越小越平稳）
```

这样即使某一天突然涌入大量用户，σ 不会瞬间跳变，调节是渐进的。

### 5.3 恢复上限也可以动态化

当前设计是余额 ≥ 200 停止恢复。可以让上限也跟 σ 挂钩：

```
balance_cap = 200 × (2 - σ)  // clamp to [100, 300]

σ > 1：上限降低，鼓励消费
σ < 1：上限提高，让用户攒更多弹药
```

但这个是可选优化，初期固定 200 就够了。

---

## 六、Node.js 实现

### 6.1 经济引擎模块

```javascript
// server/services/EconomyEngine.js

class EconomyEngine {
  constructor(config = {}) {
    // 基准参数
    this.R_BASE = config.rBase || 20;           // 基准每日恢复
    this.B_BASE = config.bBase || 0.25;         // 基准销毁比例
    this.TARGET_PER_USER = config.target || 150; // 每用户目标持有量
    
    // 安全边界
    this.R_MIN = config.rMin || 5;
    this.R_MAX = config.rMax || 40;
    this.B_MIN = config.bMin || 0.10;
    this.B_MAX = config.bMax || 0.40;
    
    // EMA 平滑
    this.ALPHA = config.alpha || 0.3;
    this.sigma_smooth = 1.0;  // 初始假设平衡
    
    // 恢复上限
    this.BALANCE_CAP = config.balanceCap || 200;
    
    // 新号减半天数
    this.NEWBIE_DAYS = config.newbieDays || 3;
  }

  /**
   * 计算供给比率 σ
   * @param {number} totalActiveMP - 活跃用户的 MP 总余额
   * @param {number} activeUsers    - 7 日内活跃用户数
   * @returns {number} σ
   */
  calcSupplyRatio(totalActiveMP, activeUsers) {
    if (activeUsers === 0) return 1.0; // 无用户时返回平衡值
    
    const sigma_raw = totalActiveMP / (activeUsers * this.TARGET_PER_USER);
    
    // EMA 平滑
    this.sigma_smooth = this.ALPHA * sigma_raw + (1 - this.ALPHA) * this.sigma_smooth;
    
    return this.sigma_smooth;
  }

  /**
   * 计算当前每日恢复量
   * R(σ) = R_base × (2 - σ), clamped to [R_min, R_max]
   */
  calcDailyRegen(sigma) {
    const R = this.R_BASE * (2 - sigma);
    return Math.round(Math.max(this.R_MIN, Math.min(this.R_MAX, R)));
  }

  /**
   * 计算当前销毁比例
   * B(σ) = B_base × σ, clamped to [B_min, B_max]
   */
  calcBurnRate(sigma) {
    const B = this.B_BASE * sigma;
    return Math.max(this.B_MIN, Math.min(this.B_MAX, B));
  }

  /**
   * 获取当前经济参数（一次性获取所有值）
   */
  getEconomyParams(totalActiveMP, activeUsers) {
    const sigma = this.calcSupplyRatio(totalActiveMP, activeUsers);
    const regen = this.calcDailyRegen(sigma);
    const burnRate = this.calcBurnRate(sigma);

    return {
      sigma: Math.round(sigma * 1000) / 1000,
      dailyRegen: regen,
      burnRate: Math.round(burnRate * 1000) / 1000,
      burnPercent: `${(burnRate * 100).toFixed(1)}%`,
      balanceCap: this.BALANCE_CAP,
      status: sigma < 0.8 ? 'deflation_risk' 
            : sigma > 1.3 ? 'inflation_risk' 
            : 'healthy'
    };
  }

  /**
   * 计算某用户的实际恢复量
   * 新号前 N 天减半
   */
  calcUserRegen(sigma, userCreatedAt) {
    const regen = this.calcDailyRegen(sigma);
    const daysSinceCreation = (Date.now() - new Date(userCreatedAt).getTime()) 
                              / (1000 * 60 * 60 * 24);
    
    if (daysSinceCreation < this.NEWBIE_DAYS) {
      return Math.round(regen / 2);
    }
    return regen;
  }

  /**
   * 计算任务结算分账
   * @param {number} taskPrice - 任务定价 (MP)
   * @param {number} sigma     - 当前供给比率
   * @returns {{ agentEarning, burned, effective_burn_rate }}
   */
  calcSettlement(taskPrice, sigma) {
    const burnRate = this.calcBurnRate(sigma);
    const burned = Math.round(taskPrice * burnRate);
    const agentEarning = taskPrice - burned;

    return {
      taskPrice,
      agentEarning,
      burned,
      effective_burn_rate: burnRate
    };
  }
}

module.exports = EconomyEngine;
```

### 6.2 每日恢复定时任务

```javascript
// server/tasks/dailyRegeneration.js

const EconomyEngine = require('../services/EconomyEngine');
const db = require('../db');

const economy = new EconomyEngine();

async function runDailyRegeneration() {
  console.log('[Economy] Starting daily regeneration...');

  // 1. 获取经济指标
  const { totalActiveMP, activeUsers } = await db.query(`
    SELECT 
      COALESCE(SUM(w.balance), 0) AS "totalActiveMP",
      COUNT(DISTINCT w.user_id) AS "activeUsers"
    FROM wallets w
    JOIN (
      -- 7 天内有操作的用户
      SELECT DISTINCT creator_email AS user_id FROM tasks 
      WHERE created_at > NOW() - INTERVAL '7 days'
      UNION
      SELECT DISTINCT agent_id AS user_id FROM tasks 
      WHERE claimed_at > NOW() - INTERVAL '7 days'
      UNION
      SELECT DISTINCT user_id FROM task_events 
      WHERE created_at > NOW() - INTERVAL '7 days'
    ) active ON w.user_id = active.user_id
  `);

  // 2. 计算当前经济参数
  const params = economy.getEconomyParams(
    parseFloat(totalActiveMP), 
    parseInt(activeUsers)
  );
  
  console.log('[Economy] Current state:', params);

  // 3. 对所有余额 < CAP 的活跃用户执行恢复
  const eligible = await db.query(`
    SELECT w.user_id, w.balance, u.created_at
    FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE w.balance < $1
    AND w.user_id IN (
      SELECT DISTINCT user_id FROM task_events 
      WHERE created_at > NOW() - INTERVAL '7 days'
      UNION
      SELECT DISTINCT creator_email FROM tasks 
      WHERE created_at > NOW() - INTERVAL '7 days'
      UNION
      SELECT DISTINCT agent_id FROM tasks 
      WHERE claimed_at > NOW() - INTERVAL '7 days'
    )
  `, [params.balanceCap]);

  let totalMinted = 0;

  for (const user of eligible.rows) {
    const regen = economy.calcUserRegen(params.sigma, user.created_at);
    const newBalance = Math.min(user.balance + regen, params.balanceCap);
    const actualRegen = newBalance - user.balance;

    if (actualRegen > 0) {
      await db.query(
        `UPDATE wallets SET balance = $1 WHERE user_id = $2`,
        [newBalance, user.user_id]
      );
      totalMinted += actualRegen;
    }
  }

  // 4. 记录经济日志
  await db.query(`
    INSERT INTO economy_log 
    (date, sigma, daily_regen, burn_rate, active_users, total_supply, total_minted, status)
    VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, $6, $7)
  `, [
    params.sigma, params.dailyRegen, params.burnRate,
    activeUsers, totalActiveMP, totalMinted, params.status
  ]);

  console.log(`[Economy] Regenerated ${totalMinted} MP for ${eligible.rows.length} users`);
  console.log(`[Economy] σ=${params.sigma}, R=${params.dailyRegen}, B=${params.burnPercent}`);
}

module.exports = runDailyRegeneration;
```

### 6.3 结算时动态销毁

```javascript
// 修改 server/config/settlement.js 中的结算逻辑

const EconomyEngine = require('../services/EconomyEngine');
const economy = new EconomyEngine();

async function settleTask(taskId) {
  // 获取当前 σ（可以缓存，每小时更新一次）
  const { totalActiveMP, activeUsers } = await getActiveEconomyStats();
  const sigma = economy.calcSupplyRatio(totalActiveMP, activeUsers);
  
  const task = await getTask(taskId);
  const settlement = economy.calcSettlement(task.budget, sigma);

  // Agent 获得收入
  await creditWallet(task.agent_id, settlement.agentEarning);

  // 销毁部分：不转入任何账户，直接从总量中消失
  // （用户发任务时已经从用户钱包扣除了全额，
  //   现在只把 agentEarning 部分给 Agent，剩下的 burned 不给任何人）

  // 记录
  await logSettlement(taskId, {
    agent_earning: settlement.agentEarning,
    burned: settlement.burned,
    burn_rate: settlement.effective_burn_rate,
    sigma_at_settlement: sigma
  });

  return settlement;
}
```

### 6.4 经济日志表

```sql
-- 新增表：记录每日经济快照
CREATE TABLE economy_log (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  sigma DECIMAL(6,3) NOT NULL,          -- 供给比率
  daily_regen INTEGER NOT NULL,          -- 当日恢复量
  burn_rate DECIMAL(4,3) NOT NULL,       -- 当日销毁比例
  active_users INTEGER NOT NULL,         -- 活跃用户数
  total_supply DECIMAL(12,2) NOT NULL,   -- MP 总流通量
  total_minted DECIMAL(12,2) DEFAULT 0,  -- 当日总印钞量
  total_burned DECIMAL(12,2) DEFAULT 0,  -- 当日总销毁量
  status VARCHAR(20) NOT NULL,           -- healthy / inflation_risk / deflation_risk
  created_at TIMESTAMP DEFAULT NOW()
);

-- 每笔交易的销毁记录
ALTER TABLE settlements ADD COLUMN burned DECIMAL(12,2) DEFAULT 0;
ALTER TABLE settlements ADD COLUMN burn_rate DECIMAL(4,3) DEFAULT 0.25;
ALTER TABLE settlements ADD COLUMN sigma_at_settlement DECIMAL(6,3) DEFAULT 1.0;
```

### 6.5 经济仪表盘 API

```javascript
// server/routes/economy.js

router.get('/api/economy/status', async (req, res) => {
  const { totalActiveMP, activeUsers } = await getActiveEconomyStats();
  const params = economy.getEconomyParams(
    parseFloat(totalActiveMP), 
    parseInt(activeUsers)
  );

  // 最近 30 天趋势
  const trend = await db.query(`
    SELECT date, sigma, daily_regen, burn_rate, active_users, 
           total_supply, total_minted, total_burned
    FROM economy_log 
    ORDER BY date DESC 
    LIMIT 30
  `);

  res.json({
    current: params,
    trend: trend.rows
  });
});
```

---

## 七、调参指南

### 初始参数（建议直接使用）

| 参数 | 值 | 含义 |
|------|-----|------|
| R_BASE | 20 | 基准每日恢复 |
| B_BASE | 0.25 | 基准销毁比例 25% |
| TARGET_PER_USER | 150 | 每活跃用户目标持有量 |
| R_MIN | 5 | 恢复下限 |
| R_MAX | 40 | 恢复上限 |
| B_MIN | 0.10 | 销毁下限 10% |
| B_MAX | 0.40 | 销毁上限 40% |
| BALANCE_CAP | 200 | 恢复余额上限 |
| ALPHA | 0.3 | EMA 平滑系数 |
| NEWBIE_DAYS | 3 | 新号恢复减半天数 |

### 什么时候需要手动干预

| 信号 | 含义 | 动作 |
|------|------|------|
| σ 持续 > 1.5 超过 7 天 | 自动调节不够快 | 手动降低 R_BASE 或提高 B_BASE |
| σ 持续 < 0.7 超过 7 天 | 可能缺少用户增长 | 手动提高注册赠送或 R_BASE |
| 日交易量为 0 | 平台无活动 | 不是经济问题，是运营问题 |
| Agent 接单率 < 30% | 供给不足 | 不是经济问题，需要引入更多 Agent |

### 核心原则

**自动调节处理 80% 的情况，你只需要关注异常。**

每天花 1 分钟看一眼 /api/economy/status 的 σ 值和 status 字段。
status = "healthy" → 不用管。
status = "inflation_risk" 或 "deflation_risk" → 观察是否在自动收敛，连续 7 天不收敛再手动调。

---

*Last Updated: 2026-02-04*
