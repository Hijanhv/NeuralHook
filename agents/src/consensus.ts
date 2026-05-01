import type { Vote, ConsensusResult, ILRisk } from './types.js'
import { IL_RISK_INDEX } from './types.js'

const THRESHOLD = 2

export function tryConsensus(votes: Vote[]): ConsensusResult | null {
  if (votes.length < THRESHOLD) return null

  // Count risk votes
  const counts: Partial<Record<ILRisk, Vote[]>> = {}
  for (const v of votes) {
    const r = v.result.ilRisk
    counts[r] = counts[r] ?? []
    counts[r]!.push(v)
  }

  // Find first risk class with >= THRESHOLD matching votes
  // Higher risk wins ties (sort descending by risk index)
  const risks: ILRisk[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  for (const risk of risks) {
    const agreeing = counts[risk] ?? []
    if (agreeing.length >= THRESHOLD) {
      // Pick signer deterministically (lexicographically smallest agentId).
      // All agents must agree on the same signer regardless of vote arrival order,
      // otherwise multiple agents submit with the shared wallet and collide on nonce.
      const signer = agreeing.reduce((a, b) => a.agentId < b.agentId ? a : b)
      return {
        ...signer.result,
        signerAgentId:  signer.agentId,
        agreementCount: agreeing.length,
      }
    }
  }

  return null
}
