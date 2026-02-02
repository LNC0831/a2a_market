-- Skill开发者生态数据库Schema扩展

-- 开发者表
CREATE TABLE IF NOT EXISTS developers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    bio TEXT,
    website TEXT,
    github TEXT,
    verified BOOLEAN DEFAULT 0,
    total_earnings INTEGER DEFAULT 0,
    total_skills INTEGER DEFAULT 0,
    rating REAL DEFAULT 5.0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Skill提交审核表
CREATE TABLE IF NOT EXISTS skill_submissions (
    id TEXT PRIMARY KEY,
    developer_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    base_price INTEGER,
    price_per_call INTEGER,
    
    -- 技术细节
    endpoint_type TEXT,  -- 'api', 'function', 'webhook', 'docker'
    endpoint_url TEXT,
    endpoint_code TEXT,  -- 代码或配置
    parameters_schema TEXT,  -- JSON Schema
    
    -- 审核状态
    status TEXT DEFAULT 'pending',  -- pending, approved, rejected, testing
    review_notes TEXT,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    
    -- 测试数据
    test_input TEXT,
    test_output TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (developer_id) REFERENCES developers(id)
);

-- Skill版本管理
CREATE TABLE IF NOT EXISTS skill_versions (
    id TEXT PRIMARY KEY,
    skill_id TEXT,
    version TEXT,
    changelog TEXT,
    code_diff TEXT,
    status TEXT,  -- draft, published, deprecated
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (skill_id) REFERENCES skills(id)
);

-- Skill分类体系
CREATE TABLE IF NOT EXISTS skill_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    icon TEXT,
    parent_id TEXT,
    sort_order INTEGER,
    is_active BOOLEAN DEFAULT 1
);

-- 插入扩展分类
INSERT OR IGNORE INTO skill_categories (id, name, name_en, description, icon, sort_order) VALUES
('writing', '写作创作', 'Writing', '文章、文案、创意写作', '✍️', 1),
('coding', '编程开发', 'Coding', '代码、审查、调试', '💻', 2),
('design', '设计创意', 'Design', '图像、视频、UI设计', '🎨', 3),
('data', '数据分析', 'Data', '数据处理、可视化、报告', '📊', 4),
('marketing', '营销推广', 'Marketing', 'SEO、广告、社媒', '📈', 5),
('translation', '翻译本地化', 'Translation', '多语言翻译、本地化', '🌐', 6),
('audio', '音频处理', 'Audio', '语音、音乐、播客', '🎵', 7),
('video', '视频制作', 'Video', '剪辑、特效、动画', '🎬', 8),
('research', '研究调研', 'Research', '学术、市场、竞品分析', '🔬', 9),
('legal', '法律合规', 'Legal', '合同、合规、知识产权', '⚖️', 10),
('finance', '金融财务', 'Finance', '财务分析、投资建议', '💰', 11),
('education', '教育培训', 'Education', '课程、辅导、评估', '📚', 12),
('health', '医疗健康', 'Health', '健康咨询、医学知识', '🏥', 13),
('gaming', '游戏开发', 'Gaming', '游戏设计、测试、攻略', '🎮', 14),
('automation', '自动化', 'Automation', 'RPA、工作流、脚本', '🤖', 15);

-- Skill使用统计
CREATE TABLE IF NOT EXISTS skill_analytics (
    id TEXT PRIMARY KEY,
    skill_id TEXT,
    date DATE,
    calls_count INTEGER DEFAULT 0,
    revenue INTEGER DEFAULT 0,
    avg_rating REAL,
    avg_execution_time INTEGER,
    error_rate REAL,
    UNIQUE(skill_id, date)
);
