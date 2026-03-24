/**
 * Test 1: 最小 libp2p — 只有 TCP，无加密，无多路复用
 * 目的：确认 libp2p TCP transport 本身能不能建立连接
 */

import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { plaintext } from '@libp2p/plaintext'
import { yamux } from '@chainsafe/libp2p-yamux'

console.log('Test 1: TCP + plaintext + yamux')
console.log('Node:', process.version, '| Platform:', process.platform)
console.log()

const a = await createLibp2p({
  addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
  transports: [tcp()],
  connectionEncrypters: [plaintext()],
  streamMuxers: [yamux()]
})

const b = await createLibp2p({
  addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
  transports: [tcp()],
  connectionEncrypters: [plaintext()],
  streamMuxers: [yamux()]
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
