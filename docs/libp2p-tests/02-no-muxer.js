/**
 * Test 2: TCP + plaintext, 无多路复用器
 * 目的：确认是 yamux 的问题还是更底层
 */

import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { plaintext } from '@libp2p/plaintext'

console.log('Test 2: TCP + plaintext (no muxer)')
console.log('Node:', process.version, '| Platform:', process.platform)
console.log()

try {
  const a = await createLibp2p({
    addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
    transports: [tcp()],
    connectionEncrypters: [plaintext()]
    // No streamMuxers
  })

  const b = await createLibp2p({
    addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
    transports: [tcp()],
    connectionEncrypters: [plaintext()]
  })

  await a.start()
  await b.start()

  const addrA = a.getMultiaddrs()[0]
  console.log('A listening:', addrA.toString())
  console.log('Dialing...')

  await b.dial(addrA)
  console.log('✅ PASS — A peers:', a.getPeers().length, '| B peers:', b.getPeers().length)

  await a.stop()
  await b.stop()
} catch (e) {
  console.log('❌ FAIL —', e.constructor.name, ':', e.message)
}

process.exit(0)
