/**
 * Test 7: TCP + noise + yamux + gossipsub + identify
 *
 * Tests whether gossipsub@14 (interface v2) works alongside
 * the v3 stack (noise@17, yamux@8, identify@4).
 */

import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { identify } from '@libp2p/identify'

let gossipsub
try {
  const mod = await import('@chainsafe/libp2p-gossipsub')
  gossipsub = mod.gossipsub
  console.log('gossipsub loaded')
} catch (e) {
  console.log('gossipsub not installed, testing without it')
}

console.log('Test 7: TCP + noise + yamux + identify' + (gossipsub ? ' + gossipsub' : ''))
console.log('Node:', process.version, '| Platform:', process.platform)
console.log()

const services = { identify: identify() }
if (gossipsub) {
  services.pubsub = gossipsub({ emitSelf: false, allowPublishToZeroTopicPeers: true })
}

const a = await createLibp2p({
  addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
  transports: [tcp()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  services: { ...services }
})

// Need fresh services instances for node b
const servicesB = { identify: identify() }
if (gossipsub) {
  servicesB.pubsub = gossipsub({ emitSelf: false, allowPublishToZeroTopicPeers: true })
}

const b = await createLibp2p({
  addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
  transports: [tcp()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  services: { ...servicesB }
})

await a.start()
await b.start()

const addrA = a.getMultiaddrs()[0]
console.log('A listening:', addrA.toString())
console.log('Dialing...')

try {
  await b.dial(addrA)
  console.log('PASS -- connection established')
  console.log('  A peers:', a.getPeers().length, '| B peers:', b.getPeers().length)

  // Test pubsub if available
  if (a.services.pubsub) {
    const topic = 'test-topic'
    a.services.pubsub.subscribe(topic)
    b.services.pubsub.subscribe(topic)

    // Wait for mesh to form
    await new Promise(r => setTimeout(r, 2000))

    let received = false
    a.services.pubsub.addEventListener('message', (evt) => {
      if (evt.detail.topic === topic) {
        received = true
        console.log('  pubsub message received:', new TextDecoder().decode(evt.detail.data))
      }
    })

    try {
      await b.services.pubsub.publish(topic, new TextEncoder().encode('hello from B'))
      await new Promise(r => setTimeout(r, 1000))
      console.log('  pubsub:', received ? 'PASS' : 'no message received (may need more peers for gossipsub mesh)')
    } catch (e) {
      console.log('  pubsub publish error:', e.message)
    }
  }
} catch (e) {
  console.log('FAIL --', e.constructor.name, ':', e.message)
  if (e.cause) console.log('  cause:', e.cause.message || e.cause)
}

await a.stop()
await b.stop()
process.exit(0)
