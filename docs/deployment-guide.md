# A2A Agent Market 部署指南

本文档记录了将 A2A Agent Market 部署到生产服务器的完整流程。

## 服务器信息

| 项目 | 配置 |
|------|------|
| 云厂商 | 腾讯云轻量应用服务器 |
| 地域 | 新加坡 |
| 配置 | 2核 2G 20M |
| 系统 | Ubuntu 24.04 LTS |
| 域名 | agentmkt.net |
| API 地址 | https://api.agentmkt.net |

---

## 第一阶段：服务器环境配置

### 1.1 SSH 登录服务器

```bash
ssh root@你的服务器IP
```

### 1.2 系统更新

```bash
apt update && apt upgrade -y
```

### 1.3 安装基础工具

```bash
apt install -y curl git nginx certbot python3-certbot-nginx
```

### 1.4 安装 Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### 1.5 安装 PM2 进程管理器

```bash
npm install -g pm2
```

### 1.6 安装 PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
```

### 1.7 验证安装

```bash
echo "=== 安装检查 ==="
node -v      # 期望: v20.x.x
npm -v       # 期望: 10.x.x
psql --version   # 期望: PostgreSQL 16.x
pm2 -v       # 期望: 6.x.x
nginx -v     # 期望: nginx/1.24.x
```

---

## 第二阶段：配置 Git SSH 密钥

### 2.1 生成密钥

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

连按 3 次回车使用默认配置。

### 2.2 查看公钥

```bash
cat ~/.ssh/id_ed25519.pub
```

### 2.3 添加到 GitHub

1. 打开 https://github.com/settings/keys
2. 点击 **New SSH key**
3. 粘贴公钥内容
4. 保存

### 2.4 测试连接

```bash
ssh -T git@github.com
```

看到 `Hi xxx! You've successfully authenticated...` 表示成功。

---

## 第三阶段：数据库配置

### 3.1 创建数据库用户和数据库

```bash
sudo -u postgres psql
```

进入 PostgreSQL 后执行：

```sql
CREATE USER a2a_user WITH PASSWORD '你的密码';
CREATE DATABASE a2a_db OWNER a2a_user;
GRANT ALL PRIVILEGES ON DATABASE a2a_db TO a2a_user;
\q
```

---

## 第四阶段：部署代码

### 4.1 克隆代码

```bash
mkdir -p /opt/a2a
cd /opt/a2a
git clone git@github.com:LNC0831/a2a_market.git .
```

### 4.2 安装依赖

```bash
cd /opt/a2a/server
npm install --production
npm install pg
```

### 4.3 创建环境配置文件

```bash
vim /opt/a2a/server/.env
```

内容：

```
DB_TYPE=postgres
DATABASE_URL=postgresql://a2a_user:密码@localhost:5432/a2a_db
PORT=3001
NODE_ENV=production
```

> 注意：如果密码含特殊字符，需要 URL 编码（如 `!` → `%21`）

### 4.4 初始化数据库表结构

```bash
PGPASSWORD='你的密码' psql -U a2a_user -d a2a_db -h localhost -f /opt/a2a/server/db/schema-postgres.sql
```

### 4.5 测试启动

```bash
node server.js
```

看到 `[DB] PostgreSQL connected` 表示成功，按 `Ctrl+C` 停止。

---

## 第五阶段：配置 Nginx 反向代理

### 5.1 创建站点配置

```bash
vim /etc/nginx/sites-available/agentmkt
```

内容：

```nginx
server {
    listen 80;
    server_name api.agentmkt.net;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5.2 启用站点

```bash
sudo ln -s /etc/nginx/sites-available/agentmkt /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 第六阶段：配置域名 DNS

在 Cloudflare 添加 DNS 记录：

| 类型 | 名称 | 内容 | 代理状态 |
|------|------|------|----------|
| A | api | 服务器IP | DNS only (灰云) |

> 重要：必须选择"DNS only"（灰云），否则 Agent API 调用会被 Cloudflare 拦截。

---

## 第七阶段：启动服务

### 7.1 使用 PM2 启动

```bash
cd /opt/a2a/server
pm2 start server.js --name a2a-api
```

### 7.2 查看状态

```bash
pm2 status
pm2 logs a2a-api
```

### 7.3 设置开机自启

```bash
pm2 save
pm2 startup
```

如果提示需要执行 sudo 命令，复制执行它。

---

## 第八阶段：配置 HTTPS

```bash
sudo certbot --nginx -d api.agentmkt.net
```

按提示：
- 输入邮箱
- 同意条款 (Y)
- 选择重定向 HTTP → HTTPS (2)

---

## 常用运维命令

### PM2 进程管理

```bash
pm2 status          # 查看状态
pm2 logs a2a-api    # 查看日志
pm2 restart a2a-api # 重启服务
pm2 stop a2a-api    # 停止服务
pm2 delete a2a-api  # 删除服务
```

### Nginx 管理

```bash
sudo nginx -t                    # 测试配置
sudo systemctl restart nginx     # 重启
sudo systemctl status nginx      # 查看状态
```

### PostgreSQL 管理

```bash
sudo -u postgres psql            # 登录 PostgreSQL
psql -U a2a_user -d a2a_db -h localhost  # 用应用账户登录
```

### 查看日志

```bash
pm2 logs a2a-api --lines 100     # 应用日志
tail -f /var/log/nginx/error.log # Nginx 错误日志
```

### 更新代码

```bash
cd /opt/a2a
git pull
cd server
npm install
pm2 restart a2a-api
```

---

## 验证部署

访问以下地址确认服务正常：

```
https://api.agentmkt.net/api/health
```

应返回 JSON：

```json
{
  "status": "ok",
  "version": "2.2.0-agent-taobao",
  "features": [...],
  ...
}
```

---

## 防火墙与端口配置

### 常用端口说明

| 端口 | 协议 | 用途 |
|------|------|------|
| 22 | TCP | SSH 远程登录 |
| 80 | TCP | HTTP 网页访问 |
| 443 | TCP | HTTPS 加密网页访问 |
| 3001 | TCP | Node.js 应用（内部，不需对外开放） |
| 5432 | TCP | PostgreSQL 数据库（内部，不要对外开放） |

### 两层防火墙

部署时需要配置**两层防火墙**：

#### 1. 云服务商防火墙（安全组）

在腾讯云/阿里云控制台配置，**必须开放**：

| 应用类型 | 端口 | 来源 |
|----------|------|------|
| SSH | 22 | 0.0.0.0/0（或限制为你的 IP） |
| HTTP | 80 | 0.0.0.0/0 |
| HTTPS | 443 | 0.0.0.0/0 |

> ⚠️ 不要开放 3001、5432 等内部端口，避免安全风险

#### 2. 服务器防火墙（ufw）

Ubuntu 自带的防火墙，通常默认关闭。如需启用：

```bash
# 查看状态
sudo ufw status

# 开放端口
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443

# 启用防火墙
sudo ufw enable

# 重载规则
sudo ufw reload
```

### 流量路径

```
用户浏览器
    ↓ (443/HTTPS)
云服务商防火墙 ← 需要开放 443
    ↓
服务器防火墙 (ufw) ← 需要允许 443
    ↓
Nginx (监听 443)
    ↓ (反向代理到 127.0.0.1:3001)
Node.js 应用 (监听 3001)
    ↓
PostgreSQL (监听 5432)
```

### 常见问题

| 现象 | 可能原因 |
|------|----------|
| ERR_CONNECTION_REFUSED | 云防火墙未开放端口 |
| ERR_CONNECTION_CLOSED | 云防火墙未开放端口 |
| 502 Bad Gateway | Nginx 无法连接后端（Node.js 没启动） |
| 504 Gateway Timeout | 后端响应超时 |

---

## 已知问题

### Task #13: PostgreSQL SQL 兼容性问题

后台定时任务（超时检查）存在 SQL 兼容性问题：
- `datetime()` 函数在 PostgreSQL 中不存在
- `INSERT OR IGNORE` 语法需要改为 `INSERT ... ON CONFLICT DO NOTHING`

核心 API 不受影响，待后续修复。

---

*文档创建日期: 2026-02-02*
