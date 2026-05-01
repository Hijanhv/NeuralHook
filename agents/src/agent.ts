import express from 'express'
import { runInference } from './og-inference.js'
import { simulatePoolMetrics } from './il-calculator.js'
import { tryConsensus } from './consensus.js'
import { triggerRebalance, getAuditLog } from './keeperhub.js'
import type { Vote, ConsensusResult, AgentStatus } from './types.js'

const NODE_ID = process.env.NODE_ID ?? '0'
const PORT    = parseInt(process.env.PORT ?? '4000')

const PEER_URLS = [
  process.env.AGENT_0 ?? 'http://localhost:4000',
  process.env.AGENT_1 ?? 'http://localhost:4001',
  process.env.AGENT_2 ?? 'http://localhost:4002',
].filter((_, i) => i !== parseInt(NODE_ID))

const INFERENCE_INTERVAL_MS = 30_000

const votes:   Map<string, Vote> = new Map()    // key = agentId
const history: ConsensusResult[] = []
let inferenceCount = 0
let voteCount      = 0
let lastConsensus  = 0
const startTime    = Date.now()

// ── Inference loop ────────────────────────────────────────────────────────────

async function runLoop(): Promise<void> {
  const start = Date.now()
  try {
    const metrics = simulatePoolMetrics()
    const result  = await runInference(metrics)
    inferenceCount++

    const myVote: Vote = {
      agentId:   `agent-${NODE_ID}`,
      result,
      latencyMs: Date.now() - start,
      timestamp: Date.now(),
    }

    votes.set(`agent-${NODE_ID}`, myVote)
    await gossipVote(myVote)

    const allVotes = Array.from(votes.values())
    const consensus = tryConsensus(allVotes)
    if (consensus) {
      lastConsensus = Date.now()
      history.push(consensus)
      if (history.length > 100) history.shift()
      votes.clear()
      // Only NODE_ID 0 submits to chain. All agents share one wallet, so allowing
      // multiple submitters causes nonce collisions. signerAgentId could disagree
      // across agents during gossip windows, so we hardcode the submitter here.
      if (NODE_ID === '0') {
        await triggerRebalance(consensus).catch(() => {})
      }
    }
  } catch (e) {
    console.error(`[agent-${NODE_ID}] inference error:`, e)
  }
}

async function gossipVote(vote: Vote): Promise<void> {
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

// ── HTTP server ───────────────────────────────────────────────────────────────

const app = express()
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
  }
  res.json(status)
})

app.get('/history', (_req, res) => {
  res.json(history)
})

app.get('/audit-log', (_req, res) => {
  res.json(getAuditLog())
})

app.post('/trigger-volatility', (_req, res) => {
  // Fire an extra inference immediately with high volatility
  void runLoop()
  res.json({ ok: true, message: `agent-${NODE_ID}: volatility triggered` })
})

app.listen(PORT, () => {
  console.log(`[agent-${NODE_ID}] listening on :${PORT}`)
  // Start inference loop
  setInterval(() => void runLoop(), INFERENCE_INTERVAL_MS)
  setTimeout(() => void runLoop(), 2000) // first run after 2s
})
