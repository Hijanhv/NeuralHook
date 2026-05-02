export type ILRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface InferenceResult {
  ilRisk: ILRisk
  ilRiskIndex: number
  predictedILBps: number
  recommendedFee: number
  rebalanceSignal: boolean
  yieldScore: number
  timestamp: number
  resultHash: string
  signature: string
  inferenceSource?: '0g' | 'local'
}

export interface Vote {
  agentId: string
  result: InferenceResult
  latencyMs: number
  timestamp: number
}

export interface ConsensusResult extends InferenceResult {
  signerAgentId: string
  agreementCount: number
}

export interface AgentStatus {
  id: string
  healthy: boolean
  lastConsensus: number
  voteCount: number
  inferenceCount: number
  uptime: number
  sqrtPriceX96?: string
}

export interface AuditEntry {
  txHash: string
  timestamp: number
  action: string
  ilRisk: ILRisk
  fee: number
  gasUsed: number
  success: boolean
  error?: string
}

export const IL_RISK_INDEX: Record<ILRisk, number> = {
  LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3,
}

export const FEE_BY_RISK: Record<ILRisk, number> = {
  LOW: 500, MEDIUM: 3000, HIGH: 7500, CRITICAL: 10000,
}
