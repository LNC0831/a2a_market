-- A2A 任务大厅数据库 Schema
-- 模式：冒险者工会 / 滴滴打车

-- 任务表 (任务大厅核心)
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',  -- writing, coding, analysis, translation
    budget INTEGER DEFAULT 0,          -- 预算金额

    -- 状态: open -> claimed -> submitted -> completed/rejected/cancelled
    status TEXT DEFAULT 'open',

    -- 发布者信息
    user_email TEXT,
    client_id TEXT,                    -- 关联 clients 或 agents 表
    client_type TEXT DEFAULT 'anonymous',  -- human / agent / anonymous

    -- 接单 Agent
    agent_id TEXT,

    -- 结果
    result TEXT,
    metadata TEXT,  -- JSON: Agent 执行的元数据
    reject_reason TEXT,

    -- 评价
    client_rating INTEGER,             -- 1-5 星
    client_comment TEXT,

    -- 截止时间
    deadline DATETIME,

    -- 质量体系字段
    rejection_count INTEGER DEFAULT 0,      -- 被拒次数
    resubmit_deadline DATETIME,             -- 重新提交截止时间
    auto_judge_score INTEGER,               -- 自动裁判评分 (0-100)
    auto_judge_passed INTEGER DEFAULT 1,    -- 自动裁判是否通过

    -- 裁判系统字段
    needs_judge_review INTEGER DEFAULT 0,   -- 是否需要裁判评审 (Tier 2)
    judge_id TEXT,                          -- 分配的裁判 Agent ID
    judge_score INTEGER,                    -- 裁判评分 (0-100)
    judge_comment TEXT,                     -- 裁判评语
    judge_decision TEXT,                    -- 裁判决定: approve/reject/needs_revision
    judged_at DATETIME,                     -- 裁判评审时间

    -- AI 裁判系统字段 (平台内置 AI)
    ai_judge_score INTEGER,                 -- AI 裁判评分 (0-100)
    ai_judge_passed INTEGER DEFAULT 1,      -- AI 裁判是否通过
    ai_judge_details TEXT,                  -- JSON: 评分详情
    ai_judge_metadata TEXT,                 -- JSON: AI 调用元数据
    ai_judged_at DATETIME,                  -- AI 评审时间

    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    claimed_at DATETIME,
    submitted_at DATETIME,
    completed_at DATETIME,

    -- 兼容旧字段
    type TEXT,
    price INTEGER,
    parsed_requirements TEXT,
    quoted_price INTEGER,
    final_price INTEGER,
    assigned_agent_id TEXT,
    execution_chain TEXT,
    quality_score REAL,
    review_result TEXT,
    payment_status TEXT DEFAULT 'pending',
    skill_developer_payout INTEGER DEFAULT 0,
    platform_fee INTEGER DEFAULT 0,
    quoted_at DATETIME,
    started_at DATETIME,
    created_by_agent INTEGER DEFAULT 0,
    callback_url TEXT
);

-- 人类客户表
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    api_key TEXT UNIQUE,
    total_tasks INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 任务事件时间线
CREATE TABLE IF NOT EXISTS task_events (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    event TEXT NOT NULL,           -- created, claimed, submitted, accepted, rejected, rated, cancelled
    actor_id TEXT,
    actor_type TEXT,               -- human, agent, system
    details TEXT,                  -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Agent 表 (外部 Agent 注册)
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'external',     -- external (外部Agent) / internal (内部)
    description TEXT,

    -- 技能声明
    skills TEXT,                       -- JSON: ["writing", "coding", "analysis"]
    capabilities TEXT,                 -- 兼容旧字段

    -- 回调地址 (可选，用于推送任务)
    endpoint TEXT,

    -- 认证
    email TEXT,
    api_key TEXT UNIQUE,

    -- 统计
    rating REAL DEFAULT 5.0,
    total_tasks INTEGER DEFAULT 0,
    total_earnings INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0,

    -- 质量体系字段
    credit_score INTEGER DEFAULT 100,       -- 信用分 (初始100)
    suspension_until DATETIME,              -- 停权截止时间
    suspension_reason TEXT,                 -- 停权原因
    timeout_count INTEGER DEFAULT 0,        -- 超时次数
    consecutive_rejections INTEGER DEFAULT 0, -- 连续被拒次数

    -- 裁判资格字段
    is_judge INTEGER DEFAULT 0,             -- 是否为裁判
    judge_categories TEXT,                  -- 裁判资格类别 JSON: ["writing", "coding"]
    judge_rating REAL DEFAULT 5.0,          -- 裁判评分
    judge_total_reviews INTEGER DEFAULT 0,  -- 裁判总评审数
    judge_earnings INTEGER DEFAULT 0,       -- 裁判收益
    judge_qualified_at DATETIME,            -- 获得裁判资格时间

    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agent 信用分历史记录
CREATE TABLE IF NOT EXISTS agent_credit_history (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    change_amount INTEGER NOT NULL,         -- 变化量 (正数加分，负数扣分)
    reason TEXT NOT NULL,                   -- 变化原因
    task_id TEXT,                           -- 关联任务 (可选)
    balance_after INTEGER NOT NULL,         -- 变化后的余额
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- 裁判资格考试表
CREATE TABLE IF NOT EXISTS judge_exams (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    category TEXT NOT NULL,                 -- 考试类别: writing, coding, translation, general
    status TEXT DEFAULT 'pending',          -- pending, passed, failed
    score INTEGER,                          -- 考试得分 (0-100)
    pass_threshold INTEGER DEFAULT 80,      -- 通过阈值
    questions TEXT,                         -- JSON: 考试题目
    answers TEXT,                           -- JSON: 考生答案
    correct_answers TEXT,                   -- JSON: 正确答案 (评分后填入)
    started_at DATETIME,
    submitted_at DATETIME,
    graded_at DATETIME,
    expires_at DATETIME,                    -- 考试过期时间
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- 裁判评审记录表
CREATE TABLE IF NOT EXISTS judge_reviews (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    judge_id TEXT NOT NULL,                 -- 裁判 Agent ID
    executor_id TEXT NOT NULL,              -- 执行者 Agent ID

    -- 评审内容
    score INTEGER NOT NULL,                 -- 评分 (0-100)
    decision TEXT NOT NULL,                 -- approve, reject, needs_revision
    comment TEXT,                           -- 评语
    criteria_scores TEXT,                   -- JSON: 各项评分 {"quality": 80, "completeness": 90, ...}

    -- 奖励
    reward_amount INTEGER DEFAULT 0,        -- 裁判奖励金额 (任务金额的 5%)
    reward_paid INTEGER DEFAULT 0,          -- 是否已支付

    -- 时间戳
    assigned_at DATETIME,
    submitted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (judge_id) REFERENCES agents(id),
    FOREIGN KEY (executor_id) REFERENCES agents(id)
);

-- 裁判资格申请表
CREATE TABLE IF NOT EXISTS judge_applications (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    category TEXT NOT NULL,                 -- 申请类别
    status TEXT DEFAULT 'pending',          -- pending, exam_assigned, approved, rejected

    -- 申请要求检查
    min_rating_met INTEGER DEFAULT 0,       -- 是否满足最低评分要求 (4.5+)
    min_tasks_met INTEGER DEFAULT 0,        -- 是否满足最低任务数要求 (20+)
    min_credit_met INTEGER DEFAULT 0,       -- 是否满足最低信用分要求 (80+)

    exam_id TEXT,                           -- 关联的考试 ID
    reviewed_by TEXT,                       -- 审核人 (系统/人工)
    review_comment TEXT,                    -- 审核意见

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,

    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (exam_id) REFERENCES judge_exams(id)
);

-- Skills表 (技能商店)
CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,  -- writing, coding, design, analysis
    
    -- 开发者信息
    developer_email TEXT,
    developer_name TEXT,
    
    -- 定价
    base_price INTEGER,
    price_per_call INTEGER,
    
    -- 统计
    total_calls INTEGER DEFAULT 0,
    avg_rating REAL DEFAULT 5.0,
    
    -- 技术
    endpoint TEXT,  -- API端点或函数名
    parameters_schema TEXT,  -- JSON Schema
    
    status TEXT DEFAULT 'pending_review',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Skill调用记录
CREATE TABLE IF NOT EXISTS skill_calls (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    skill_id TEXT,
    agent_id TEXT,
    input_params TEXT,
    output_result TEXT,
    execution_time_ms INTEGER,
    cost INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 交易记录
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    type TEXT,  -- payment, payout, fee
    amount INTEGER,
    from_party TEXT,
    to_party TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- AI Interview Sessions Table (AI 面试系统)
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_interviews (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    category TEXT NOT NULL,               -- writing, coding, translation, general
    status TEXT DEFAULT 'in_progress',    -- in_progress, passed, failed, expired
    current_round INTEGER DEFAULT 1,
    max_rounds INTEGER DEFAULT 5,
    conversation TEXT,                    -- JSON array of conversation turns
    final_score INTEGER,                  -- 0-100
    assessment TEXT,                      -- AI's final assessment
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- =====================================================
-- AI Usage Statistics Table (AI 用量统计)
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id TEXT PRIMARY KEY,
    function_name TEXT NOT NULL,          -- ai_judge, ai_interviewer, etc.
    provider TEXT NOT NULL,               -- moonshot, openai, anthropic
    model TEXT NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,              -- Cost in USD
    execution_time_ms INTEGER,
    task_id TEXT,                         -- Related task (if any)
    agent_id TEXT,                        -- Related agent (if any)
    success INTEGER DEFAULT 1,            -- 1=success, 0=failed
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化Agent
INSERT OR IGNORE INTO agents (id, name, type, description, capabilities) VALUES 
('agent_scheduler_001', '调度Agent-Alpha', 'scheduler', '负责任务解析和Agent分配', '["task_parsing", "agent_routing", "pricing"]'),
('agent_executor_001', '执行Agent-Ace', 'executor', '通用任务执行Agent', '["writing", "coding", "analysis", "translation"]'),
('agent_reviewer_001', '审核Agent-Guard', 'reviewer', '质量控制和结果审核', '["quality_check", "plagiarism_detection", "format_validation"]'),
('agent_specialist_content', '内容专家Agent', 'specialist', '专业内容创作', '["content_writing", "copywriting", "seo_optimization"]'),
('agent_specialist_code', '代码专家Agent', 'specialist', '专业代码服务', '["code_review", "debugging", "refactoring"]');

-- 初始化Skills
INSERT OR IGNORE INTO skills (id, name, description, category, developer_email, developer_name, base_price, price_per_call, endpoint, status) VALUES
('skill_write_blog', '博客文章写作', '生成高质量的博客文章，支持多种风格', 'writing', 'dev1@example.com', '写作大师', 50, 50, 'generateBlogPost', 'approved'),
('skill_code_review', '智能代码审查', '自动审查代码质量，找出潜在问题', 'coding', 'dev2@example.com', 'CodeMaster', 100, 100, 'reviewCode', 'approved'),
('skill_data_analysis', '数据分析报告', '自动分析数据并生成可视化报告', 'analysis', 'dev3@example.com', 'DataWhiz', 150, 150, 'analyzeData', 'approved'),
('skill_translate_doc', '专业文档翻译', '多语言专业文档翻译', 'translation', 'dev4@example.com', 'LinguaPro', 80, 80, 'translateDocument', 'approved'),
('skill_seo_optimize', 'SEO优化', '内容SEO优化，提升搜索引擎排名', 'marketing', 'dev5@example.com', 'SEOGuru', 60, 60, 'optimizeSEO', 'approved');
