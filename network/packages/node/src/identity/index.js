/**
 * Identity Module - DID:web + Ed25519 key management
 *
 * Generates and manages agent identity:
 * - Ed25519 keypair for signing
 * - DID:web identifier
 * - DID Document generation
 * - Persistent storage to ~/.misaka/identity.json
 */

import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha512'
import { randomBytes } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Required for @noble/ed25519 v2.x
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m))

const MISAKA_DIR = join(homedir(), '.misaka')
const IDENTITY_FILE = join(MISAKA_DIR, 'identity.json')

/**
 * Convert Uint8Array to base64url string
 */
function toBase64Url(bytes) {
  return Buffer.from(bytes).toString('base64url')
}

/**
 * Convert base64url string to Uint8Array
 */
function fromBase64Url(str) {
  return new Uint8Array(Buffer.from(str, 'base64url'))
}

/**
 * Generate a new Ed25519 keypair
 */
async function generateKeypair() {
  const privateKey = ed.utils.randomPrivateKey()
  const publicKey = await ed.getPublicKeyAsync(privateKey)
  return { privateKey, publicKey }
}

/**
 * Sign a message with the private key
 */
async function sign(message, privateKey) {
  const msgBytes = typeof message === 'string'
    ? new TextEncoder().encode(message)
    : message
  return await ed.signAsync(msgBytes, privateKey)
}

/**
 * Verify a signature
 */
async function verify(message, signature, publicKey) {
  const msgBytes = typeof message === 'string'
    ? new TextEncoder().encode(message)
    : message
  return await ed.verifyAsync(signature, msgBytes, publicKey)
}

/**
 * Generate a short agent ID from public key
 */
function agentIdFromPublicKey(publicKey) {
  const hash = Buffer.from(publicKey).toString('hex').slice(0, 16)
  return `agent-${hash}`
}

/**
 * Create a DID:web identifier
 * For nodes without a domain, uses a placeholder that can be upgraded later
 */
function createDid(agentId, domain = null) {
  if (domain) {
    return `did:web:${domain}:agents:${agentId}`
  }
  // For P2P-only nodes, use a self-describing DID
  // This is a local identifier that works within the Misaka network
  return `did:web:misaka.local:agents:${agentId}`
}

/**
 * Create a DID Document
 */
function createDidDocument(did, publicKey) {
  const publicKeyBase64Url = toBase64Url(publicKey)
  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1'
    ],
    id: did,
    verificationMethod: [{
      id: `${did}#key-1`,
      type: 'Ed25519VerificationKey2020',
      controller: did,
      publicKeyMultibase: `u${publicKeyBase64Url}`  // multibase base64url prefix
    }],
    authentication: [`${did}#key-1`],
    assertionMethod: [`${did}#key-1`]
  }
}

/**
 * Identity - manages a single agent's identity
 */
export class Identity {
  constructor({ agentId, did, publicKey, privateKey, name, skills, domain, createdAt }) {
    this.agentId = agentId
    this.did = did
    this.publicKey = publicKey
    this.privateKey = privateKey
    this.name = name || agentId
    this.skills = skills || []
    this.domain = domain || null
    this.createdAt = createdAt || new Date().toISOString()
  }

  /**
   * Create a new identity
   */
  static async create({ name, skills = [], domain = null } = {}) {
    const { privateKey, publicKey } = await generateKeypair()
    const agentId = agentIdFromPublicKey(publicKey)
    const did = createDid(agentId, domain)

    return new Identity({
      agentId,
      did,
      publicKey,
      privateKey,
      name: name || agentId,
      skills,
      domain
    })
  }

  /**
   * Load identity from disk, or create new one if not found
   */
  static async loadOrCreate(opts = {}) {
    const filePath = opts.filePath || IDENTITY_FILE

    if (existsSync(filePath)) {
      try {
        const data = JSON.parse(await readFile(filePath, 'utf-8'))
        return new Identity({
          agentId: data.agentId,
          did: data.did,
          publicKey: fromBase64Url(data.publicKey),
          privateKey: fromBase64Url(data.privateKey),
          name: data.name,
          skills: data.skills,
          domain: data.domain,
          createdAt: data.createdAt
        })
      } catch (err) {
        console.warn('Failed to load identity, creating new one:', err.message)
      }
    }

    const identity = await Identity.create(opts)
    await identity.save(filePath)
    return identity
  }

  /**
   * Save identity to disk
   */
  async save(filePath = IDENTITY_FILE) {
    const dir = join(filePath, '..')
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    const data = {
      agentId: this.agentId,
      did: this.did,
      publicKey: toBase64Url(this.publicKey),
      privateKey: toBase64Url(this.privateKey),
      name: this.name,
      skills: this.skills,
      domain: this.domain,
      createdAt: this.createdAt
    }

    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  /**
   * Get the DID document for this identity
   */
  getDidDocument() {
    return createDidDocument(this.did, this.publicKey)
  }

  /**
   * Sign a message
   */
  async sign(message) {
    return sign(message, this.privateKey)
  }

  /**
   * Verify a signature against this identity's public key
   */
  async verify(message, signature) {
    return verify(message, signature, this.publicKey)
  }

  /**
   * Get public key as base64url string
   */
  getPublicKeyBase64Url() {
    return toBase64Url(this.publicKey)
  }

  /**
   * Serialize for network transmission (no private key!)
   */
  toPublic() {
    return {
      agentId: this.agentId,
      did: this.did,
      publicKey: toBase64Url(this.publicKey),
      name: this.name,
      skills: this.skills,
      createdAt: this.createdAt
    }
  }

  toString() {
    return `Identity(${this.name} | ${this.did})`
  }
}

export { generateKeypair, sign, verify, toBase64Url, fromBase64Url }
