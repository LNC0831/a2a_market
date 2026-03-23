/**
 * Test 4: TCP + noise + mplex — 完整加密 + 多路复用
 */

import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { mplex } from '@libp2p/mplex'
import { identify } from '@libp2p/identify'

console.log('Test 4: TCP + noise + mplex + identify')
console.log('Node:', process.version, '| Platform:', process.platform)
console.log()

const a = await createLibp2p({
  addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
  transports: [tcp()],
  connectionEncrypters: [noise()],
  streamMuxers: [mplex()],
  services: { identify: identify() }
})

const b = await createLibp2p({
  addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
  transports: [tcp()],
  connectionEncrypters: [noise()],
  streamMuxers: [mplex()],
  services: { identify: identify() }
})

await a.start()
await b.start()

const addrA = a.getMultiaddrs()[0]
console.log('A listening:', addrA.toString())
console.log('Dialing...')

try {
  await b.dial(addrA)
  console.log('✅ PASS — A peers:', a.getPeers().length, '| B peers:', b.getPeers().length)
} catch (e) {
  console.log('❌ FAIL —', e.constructor.name, ':', e.message)
}

await a.stop()
await b.stop()
process.exit(0)
