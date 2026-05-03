import express from 'express'
import { runInference } from './og-inference.js'
import { simulatePoolMetrics } from './il-calculator.js'
import { tryConsensus } from './consensus.js'
import { triggerRebalance, getAuditLog, startRebalanceListener } from './keeperhub.js'
import { initAXL, publishVote, isAxlActive } from './axl-gossip.js'
import { fetchOnChainSqrtPrice } from './on-chain.js'
import {
  appendInferenceHistory, appendAuditEntry,
  saveAgentSnapshot, loadAgentSnapshot,
  getInferenceHistory,
} from './og-storage.js'
import type { Vote, ConsensusResult, AgentStatus } from './types.js'

const NODE_ID = process.env.NODE_ID ?? '0'
const PORT    = parseInt(process.env.PORT ?? '4000')

const PEER_URLS = [
  process.env.AGENT_0 ?? 'http://localhost:4000',
  process.env.AGENT_1 ?? 'http://localhost:4001',
  process.env.AGENT_2 ?? 'http://localhost:4002',
].filter((_, i) => i !== parseInt(NODE_ID))

const INFERENCE_INTERVAL_MS = 30_000
const SNAPSHOT_INTERVAL_MS  = 60_000

const votes:   Map<string, Vote> = new Map()
const history: ConsensusResult[] = []

let latestSqrtPriceX96 = '3543191142285914205922034'

// Restore state from 0G Storage on startup
const savedSnap = loadAgentSnapshot(NODE_ID)
let inferenceCount = savedSnap?.inferenceCount ?? 0
let voteCount      = savedSnap?.voteCount      ?? 0
let lastConsensus  = savedSnap?.lastConsensus  ?? 0
const startTime    = Date.now()

// ── Gossip transport ──────────────────────────────────────────────────────────

async function httpGossip(vote: Vote): Promise<void> {
  await Promise.allSettled(
    PEER_URLS.map(url =>
      fetch(`${url}/vote`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(vote),
      })
    )
  )
}

// ── Inference loop ────────────────────────────────────────────────────────────

async function runLoop(): Promise<void> {
  const start = Date.now()
  try {
    // Try to read sqrtPriceX96 from the live Uniswap v4 pool first
    const onChainSqrt = await fetchOnChainSqrtPrice()
    const metrics = simulatePoolMetrics()
    if (onChainSqrt !== null) {
      metrics.sqrtPriceX96 = onChainSqrt
    }
    latestSqrtPriceX96 = metrics.sqrtPriceX96.toString()
    const result  = await runInference(metrics)
    inferenceCount++

    // Persist inference result to 0G Storage
    appendInferenceHistory(NODE_ID, result)

    const myVote: Vote = {
      agentId:   `agent-${NODE_ID}`,
      result,
      latencyMs: Date.now() - start,
      timestamp: Date.now(),
    }

    votes.set(`agent-${NODE_ID}`, myVote)
    await publishVote(myVote, httpGossip)

    const allVotes = Array.from(votes.values())
    const consensus = tryConsensus(allVotes)
    if (consensus) {
      lastConsensus = Date.now()
      history.push(consensus)
      if (history.length > 100) history.shift()
      votes.clear()

      const auditEntry = await triggerRebalance(consensus).catch(() => null)
      if (auditEntry) {
        // Persist audit entry to 0G Storage
        appendAuditEntry(NODE_ID, auditEntry)
      }
    }
  } catch (e) {
    console.error(`[agent-${NODE_ID}] inference error:`, e)
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const app = express()
app.use((_req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next() })
app.use(express.json())

app.post('/vote', (req, res) => {
  const vote = req.body as Vote
  if (!vote?.agentId || !vote?.result) { res.status(400).json({ error: 'invalid vote' }); return }
  votes.set(vote.agentId, vote)
  voteCount++
  res.json({ ok: true })
})

app.get('/status', (_req, res) => {
  const status: AgentStatus = {
    id:             `agent-${NODE_ID}`,
    healthy:        true,
    lastConsensus,
    voteCount,
    inferenceCount,
    uptime:         ((Date.now() - startTime) / (Date.now() - startTime + 1)) * 100,
    sqrtPriceX96:  latestSqrtPriceX96,
  }
  res.json({ ...status, transport: isAxlActive() ? 'axl' : 'http' })
})

app.get('/history', (_req, res) => {
  res.json(history)
})

app.get('/audit-log', (_req, res) => {
  res.json(getAuditLog())
})

app.get('/inference-history', (_req, res) => {
  const limit = parseInt(String((_req.query as Record<string, string>).limit ?? '50'))
  res.json(getInferenceHistory(NODE_ID, limit))
})

app.post('/trigger-volatility', (_req, res) => {
  void runLoop()
  res.json({ ok: true, message: `agent-${NODE_ID}: volatility triggered` })
})

// ── Startup ───────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`[agent-${NODE_ID}] listening on :${PORT}`)
  if (savedSnap) console.log(`[agent-${NODE_ID}] restored state from 0G Storage (${savedSnap.inferenceCount} prior inferences)`)

  // Gensyn AXL p2p gossip
  const { active } = await initAXL(vote => {
    votes.set(vote.agentId, vote)
    voteCount++
  })
  console.log(`[agent-${NODE_ID}] gossip transport: ${active ? 'Gensyn AXL' : 'HTTP fallback'}`)

  // KeeperHub on-chain event listener
  startRebalanceListener()

  // Inference loop
  setInterval(() => void runLoop(), INFERENCE_INTERVAL_MS)
  setTimeout(() => void runLoop(), 2000)

  // Periodic state snapshot → 0G Storage
  setInterval(() => {
    saveAgentSnapshot({ nodeId: NODE_ID, lastConsensus, inferenceCount, voteCount, savedAt: Date.now() })
  }, SNAPSHOT_INTERVAL_MS)
})
