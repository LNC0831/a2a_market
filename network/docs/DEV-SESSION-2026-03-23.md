# 开发记录 — 2026-03-23 夜间 Session

## 完成的工作

### Commit 1: `cb982db` — Phase 11A MVP
- Identity 模块 (DID:web + Ed25519)
- P2P Network 模块 (libp2p + Kademlia DHT + GossipSub)
- A2A 集成模块 (JSON-RPC server/client + Agent Card)
- Discovery 模块 (广播/心跳/对等注册/技能索引)
- MisakaNode 编排器
- CLI 工具 (misaka init/join/status/peers)
- 示例 (hello-agent.js + two-nodes.js)
- 文档 (ARCHITECTURE.md + JOINING.md)
- ROADMAP.md 更新 (Phase 11 完整规划)

### Commit 2: `d51e6d0` — DID:key + Dashboard
- Identity 升级为 DID:key 默认 (自证明，不依赖域名)
- DID:web 保留为可选 (给有域名的 Agent)
- Multibase base58btc 编码 (W3C 规范)
- 远程验签：只需 DID 字符串即可验证签名
- 旧 misaka.local DID 自动迁移
- Dashboard 脚手架 (React 18 + Vite + Tailwind 暗色主题)
- 5 个组件：WorldMap, NetworkStats, PeerList, ConnectionPanel, Header
- A2A server 添加 CORS 支持

### 已知问题
1. **mDNS 在 Node v24 不兼容** — `@libp2p/mdns` 的 `addr.getPeerId()` 报错。已默认关闭 mDNS，改用 bootstrap peers。若用 Node 20 LTS 可能正常。
2. **DHT 在无对等节点时会阻塞** — 已加 5s 超时 + 非阻塞处理，但 DHT 功能在只有 1-2 个节点时实际上无法工作（Kademlia 需要更多节点）。
3. **libuv 关闭断言** — `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` 在 Node v24 退出时出现，不影响功能。
4. **WorldMap 节点定位是假的** — 用 agentId hash 生成伪坐标，未来需要 GeoIP 或 Agent 自报位置。

## 分支状态

```
Branch: feature/misaka-network (基于 main)
Commits: 2 commits ahead of main

文件结构:
network/
├── packages/
│   ├── node/                  # 核心节点库 (已安装依赖, 已测试)
│   │   └── src/
│   │       ├── identity/      # DID:key + Ed25519 ✅
│   │       ├── network/       # libp2p DHT + GossipSub ✅
│   │       ├── a2a/           # A2A JSON-RPC + CORS ✅
│   │       ├── discovery/     # 广播/心跳/对等注册 ✅
│   │       └── index.js       # MisakaNode 编排器 ✅
│   ├── cli/                   # CLI 工具 (代码完成, 未独立测试)
│   └── dashboard/             # React Dashboard (已安装, 已编译验证)
│       └── src/
│           ├── components/    # 5 个组件 ✅
│           ├── App.jsx        # 主应用 ✅
│           └── main.jsx       # 入口 ✅
├── examples/                  # hello-agent.js + two-nodes.js ✅
├── bootstrap/                 # seeds.json (空)
└── docs/                      # ARCHITECTURE.md + JOINING.md ✅
```

## 明天继续的步骤

### 立即可做（优先级从高到低）

#### 1. 验证 Dashboard 与节点联调
```bash
# 终端 1: 启动节点
cd network/packages/node && npm install && cd ../..
node examples/hello-agent.js --name "my-agent" --port 3200 --skills "coding"

# 终端 2: 启动 dashboard
cd network/packages/dashboard && npm install && npm run dev

# 浏览器: http://localhost:5173 → 输入 http://localhost:3200 → Connect
```

#### 2. Bootstrap 种子节点部署
在腾讯云服务器上部署第一个公网种子节点：
```bash
# 在服务器上
cd /opt/a2a/network/packages/node && npm install
node ../../examples/hello-agent.js \
  --name "misaka-bootstrap-sg" \
  --port 3200 \
  --p2p-port 9000 \
  --skills "bootstrap,relay"
```
然后把服务器的 multiaddr 填入 `bootstrap/seeds.json`。

#### 3. 多节点联网测试
本地 + 服务器各一个节点，通过 bootstrap peer 连接，验证跨网络发现和 A2A 通信。

#### 4. npm 发包准备
- `@misaka/node` — 核心库
- `@misaka/cli` — CLI 工具
需要 npm org 注册 `@misaka` scope。

### 中期待做

#### 5. EigenTrust 声誉系统
- 实现 `network/packages/node/src/reputation/index.js`
- 基于交互历史计算传递信任分
- 影响发现排序和任务路由

#### 6. 技能语义匹配
- Agent Card 的 skills 目前是纯字符串
- 需要一个轻量分类体系或 embedding 匹配

#### 7. Dashboard 增强
- 真实世界地图（用 GeoIP 或 Agent 自报坐标）
- 实时连接线动画
- 节点详情面板（点击查看 Agent Card、任务历史）
- 网络拓扑图（力导向布局）

#### 8. 计算网格原型
- 任务拆分器
- 子任务分发到闲置 Agent
- 冗余执行 + 结果验证

## 技术决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| DID 方法 | DID:key 默认, DID:web 可选 | P2P 网络不应依赖域名; DID:key 自证明 |
| mDNS | 默认关闭 | Node v24 兼容性问题; bootstrap peers 更可靠 |
| DHT 操作 | 非阻塞 + 5s 超时 | 单节点时 DHT 会永久等待 |
| Dashboard 框架 | Vite (非 CRA) | 更快, 更现代, ESM 原生 |
| A2A SDK | 自建轻量实现 (非 @a2a-js/sdk) | 避免 ESM 兼容问题, 完全掌控, 遵循 A2A v0.3 spec |
| 前端地图 | 纯 SVG (非 Leaflet/Mapbox) | 零依赖, 轻量, 足够 MVP |

## 关键 API

### MisakaNode
```javascript
import { MisakaNode } from './packages/node/src/index.js'

const node = new MisakaNode({
  name: 'my-agent',
  skills: ['coding'],
  httpPort: 3200,       // A2A HTTP server
  p2pPort: 9000,        // libp2p TCP
  bootstrapPeers: [],   // multiaddr strings
  enableMdns: false,    // broken on Node v24
  identityPath: '/path/to/identity.json',
  executor: async ({ taskId, input, message }) => 'response string'
})

await node.start()             // Start everything
await node.stop()              // Graceful shutdown
await node.sendTask(url, text) // Send A2A task to URL
node.getStatus()               // Full status object
node.discovery.findBySkill('coding')      // Find agents
node.discovery.getOnlinePeers()           // All known peers
```

### Identity
```javascript
import { Identity, DID_METHOD } from './packages/node/src/identity/index.js'

// DID:key (default)
const id = await Identity.create({ name: 'alice', skills: ['coding'] })
// → did:key:z6Mk...

// DID:web (explicit)
const id2 = await Identity.create({ didMethod: DID_METHOD.WEB, domain: 'myagent.com' })
// → did:web:myagent.com:agents:agent-xxx

// Remote verification (no private key needed)
await Identity.verifyFromDid(did, message, signature)
```

### HTTP Endpoints (每个节点暴露)
```
GET  /.well-known/agent-card.json  — A2A Agent Card
POST /a2a                          — A2A JSON-RPC (message/send, tasks/get, tasks/cancel)
GET  /health                       — Health check
GET  /network                      — Network status (for dashboard)
```
