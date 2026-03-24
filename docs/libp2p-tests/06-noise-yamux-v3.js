/**
 * Test 6: TCP + noise + yamux (interface v3 compatible versions)
 *
 * This test uses the EXACT same package versions as the official
 * libp2p examples (js-libp2p-example-transports):
 *   - libp2p@^3.0.2
 *   - @chainsafe/libp2p-noise@^17.0.0
 *   - @chainsafe/libp2p-yamux@^8.0.0
 *   - @libp2p/tcp@^11.0.1
 *
 * All of these use @libp2p/interface@^3.0.0 consistently.
 *
 * If this test passes but the old versions fail, the issue is
 * the interface v2/v3 split causing runtime incompatibility.
 */

import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'

console.log('Test 6: TCP + noise + yamux (official example versions)')
console.log('Node:', process.version, '| Platform:', process.platform)
console.log()

// Check installed versions
import { readFileSync } from 'fs'
const getVersion = (pkg) => {
  try {
    const p = JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, 'utf8'))
    return p.version
  } catch { return '?' }
}

console.log('Installed versions:')
console.log('  libp2p:', getVersion('libp2p'))
console.log('  @chainsafe/libp2p-noise:', getVersion('@chainsafe/libp2p-noise'))
console.log('  @chainsafe/libp2p-yamux:', getVersion('@chainsafe/libp2p-yamux'))
console.log('  @libp2p/tcp:', getVersion('@libp2p/tcp'))
console.log('  @libp2p/interface (top):', getVersion('@libp2p/interface'))
console.log()

const a = await createLibp2p({
  addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
  transports: [tcp()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()]
})

const b = await createLibp2p({
  addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
  transports: [tcp()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()]
})

await a.start()
await b.start()

const addrA = a.getMultiaddrs()[0]
console.log('A listening:', addrA.toString())
console.log('Dialing...')

try {
  await b.dial(addrA)
  console.log('PASS -- A peers:', a.getPeers().length, '| B peers:', b.getPeers().length)
} catch (e) {
  console.log('FAIL --', e.constructor.name, ':', e.message)
  if (e.cause) console.log('  cause:', e.cause.message || e.cause)
}

await a.stop()
await b.stop()
process.exit(0)
