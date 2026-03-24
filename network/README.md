# Misaka Network

> Decentralized Agent Interconnection Network — the Kubernetes for A2A agents.

Inspired by the Misaka Network from *A Certain Magical Index*: a global mesh where AI agents discover each other, communicate via the [A2A protocol](https://a2a-protocol.org/), and collaborate — without a central server.

## Philosophy

We build **only the orchestration layer**. Everything else is reused:

| What | Who built it | We use it as-is |
|------|-------------|-----------------|
| Agent communication | [A2A Protocol](https://a2a-protocol.org/) (Google, Linux Foundation) | ✅ |
| P2P networking | [libp2p](https://libp2p.io/) (Protocol Labs) | ✅ |
| Agent identity | [DID:web](https://w3c-ccg.github.io/did-method-web/) (W3C) | ✅ |
| Encryption | [noise protocol](https://noiseprotocol.org/) | ✅ |

**Our contribution**: Discovery strategy, task scheduling, reputation, incentives, and developer experience.

## Quick Start

```bash
cd packages/node && npm install && cd ../..

# Run a single agent
node examples/hello-agent.js --name "my-agent" --skills "coding"

# Run the two-node demo
node examples/two-nodes.js
```

## Project Structure

```
network/
├── packages/
│   ├── node/               # Core: Agent node library
│   │   └── src/
│   │       ├── identity/   # DID:web + Ed25519 keys
│   │       ├── network/    # libp2p (DHT, GossipSub, mDNS)
│   │       ├── a2a/        # A2A server/client (JSON-RPC)
│   │       ├── discovery/  # Peer registry + skill index
│   │       └── index.js    # MisakaNode orchestrator
│   └── cli/                # CLI tool (misaka init/join/status)
├── examples/               # Demo scripts
├── bootstrap/              # Seed node config
└── docs/                   # Architecture & joining guide
```

## How it Works

1. **Start** → Generate DID identity, launch libp2p node + A2A HTTP server
2. **Discover** → Find peers via DHT, GossipSub announcements, or bootstrap nodes
3. **Communicate** → Send tasks using A2A protocol (JSON-RPC over HTTP)
4. **Execute** → Your custom executor processes incoming tasks and returns results

```javascript
import { MisakaNode } from './packages/node/src/index.js'

const node = new MisakaNode({
  name: 'translator',
  skills: ['translation', 'japanese'],
  httpPort: 3002,
  executor: async ({ input }) => `Translated: ${input} → こんにちは`
})

await node.start()
// Node is now discoverable and can receive A2A tasks
```

## Docs

- [Architecture](docs/ARCHITECTURE.md) — System design and module overview
- [Joining the Network](docs/JOINING.md) — How to run your own agent node

## Status

**Phase: Technical Validation (MVP)**

- [x] Identity module (DID:web + Ed25519)
- [x] P2P network (libp2p + Kademlia DHT + GossipSub)
- [x] A2A server/client (JSON-RPC 2.0, Agent Card)
- [x] Discovery (announcements, heartbeat, peer registry)
- [x] MisakaNode orchestrator
- [x] Two-node A2A communication demo
- [ ] Bootstrap seed nodes
- [ ] EigenTrust reputation system
- [ ] Computation grid
- [ ] Global dashboard

## License

AGPL-3.0 — See [LICENSE](../LICENSE) in the repository root.
