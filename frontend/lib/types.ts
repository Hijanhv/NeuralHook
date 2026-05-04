export type ILRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface InferenceResult {
  ilRisk: ILRisk
  predictedILBps: number
  recommendedFee: number
  rebalanceSignal: boolean
  yieldScore: number
  timestamp: number
  signature: string
}

export interface Vote {
  agentId: string
  result: InferenceResult
  latencyMs: number
  timestamp: number
}

export interface RebalanceQuote {
  chainId: number
  tokenIn: string
  tokenOut: string
  amountIn: string
  amountOut: string
  priceETHUSD: number
  route: string
  priceImpactPct: number
  gasFeeUSD: string
  quoteId: string
  fetchedAt: number
}

export interface SwapExecution {
  txHash: string
  chainId: number
  amountInWei: string
  executedAt: number
}

export interface ConsensusResult {
  ilRisk: ILRisk
  predictedILBps: number
  recommendedFee: number
  rebalanceSignal: boolean
  yieldScore: number
  timestamp: number
  signature: string
  signerAgentId: string
  agreementCount: number
  rebalanceQuote?: RebalanceQuote
  swapExecution?: SwapExecution
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
}

export interface PoolStats {
  tvl: number
  volume24h: number
  fee24h: number
  currentTick: number
  sqrtPriceX96: string
  ilProtected: number
}

export interface LPPosition {
  id: string
  tickLower: number
  tickUpper: number
  liquidity: string
  entryPrice: number
  currentIL: number
  ilRisk: ILRisk
  claimableInsurance: number
}
