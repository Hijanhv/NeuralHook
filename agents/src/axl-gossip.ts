/**
 * Gensyn AXL pub/sub transport for inter-agent vote gossip.
 *
 * When AXL_URL is set and the AXL binary is reachable, this module gossips
 * votes over the Gensyn AXL p2p mesh using axl-pubsub.  When AXL is not
 * available (local dev, testnet without binary) it transparently falls back
 * to direct HTTP POSTs between the Express agent servers.
 */
import { Gossip, parseKeyPairFromPem } from 'axl-pubsub'
import * as fs from 'node:fs'
import type { Vote } from './types.js'

const TOPIC = 'neuralhook/votes'

const AXL_URL      = process.env.AXL_URL       // e.g. http://localhost:9002
const AXL_KEY_PATH = process.env.AXL_KEY_PATH  // path to ed25519 PEM key

let gossip: Gossip | null = null
let axlActive = false

// Called once at agent startup.
export async function initAXL(
  onVote: (vote: Vote) => void,
): Promise<{ active: boolean }> {
  if (!AXL_URL) {
    console.log('[axl-gossip] AXL_URL not set — using HTTP fallback')
    return { active: false }
  }

  try {
    const opts: ConstructorParameters<typeof Gossip>[0] = { axlUrl: AXL_URL }

    if (AXL_KEY_PATH && fs.existsSync(AXL_KEY_PATH)) {
      const pem = fs.readFileSync(AXL_KEY_PATH, 'utf8')
      opts.keyPair = await parseKeyPairFromPem(pem)
    }

    gossip = new Gossip(opts)
    await gossip.start()
    axlActive = true

    await gossip.subscribe(TOPIC, msg => {
      try {
        const vote = JSON.parse(Buffer.from(msg.payload).toString('utf8')) as Vote
        onVote(vote)
      } catch {
        // malformed payload — ignore
      }
    })

    console.log(`[axl-gossip] connected to Gensyn AXL at ${AXL_URL}, subscribed to ${TOPIC}`)
    return { active: true }
  } catch (e) {
    console.warn(`[axl-gossip] AXL start failed (${(e as Error).message}) — using HTTP fallback`)
    gossip = null
    axlActive = false
    return { active: false }
  }
}

// Broadcast a vote to all peers via AXL.  Falls back to HTTP if AXL is not
// running.  httpFallback receives the list of peer URLs to POST to.
export async function publishVote(
  vote: Vote,
  httpFallback: (vote: Vote) => Promise<void>,
): Promise<void> {
  if (axlActive && gossip) {
    try {
      const payload = Buffer.from(JSON.stringify(vote))
      await gossip.publish(TOPIC, payload)
      return
    } catch (e) {
      console.warn(`[axl-gossip] publish failed (${(e as Error).message}) — falling back to HTTP`)
    }
  }
  await httpFallback(vote)
}

export function isAxlActive(): boolean {
  return axlActive
}

export async function stopAXL(): Promise<void> {
  if (gossip) {
    await gossip.stop().catch(() => {})
    gossip = null
    axlActive = false
  }
}
