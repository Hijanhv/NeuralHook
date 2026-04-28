import { ethers } from 'ethers'
import type { ConsensusResult, AuditEntry } from './types.js'

const RPC_URL    = process.env.RPC_URL       ?? 'https://sepolia.unichain.org'
const PK         = process.env.PRIVATE_KEY   ?? '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const HOOK_ADDR  = process.env.HOOK_ADDRESS  ?? '0x0000000000000000000000000000000000000001'

const HOOK_ABI = [
  'function submitConsensusResult(bytes32 resultHash, uint8 ilRisk, uint256 predictedILBps, uint24 recommendedFee, bool rebalanceSignal, uint8 yieldScore, uint256 timestamp, bytes calldata signature) external',
]

const auditLog: AuditEntry[] = []

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, baseDelayMs * 2 ** i))
    }
  }
  throw lastErr
}

export async function triggerRebalance(consensus: ConsensusResult): Promise<AuditEntry> {
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet   = new ethers.Wallet(PK, provider)
  const hook     = new ethers.Contract(HOOK_ADDR, HOOK_ABI, wallet)

  const entry: AuditEntry = {
    txHash:    '0x' + '0'.repeat(64),
    timestamp: Date.now(),
    action:    'submitConsensusResult',
    ilRisk:    consensus.ilRisk,
    fee:       consensus.recommendedFee,
    gasUsed:   0,
    success:   false,
  }

  try {
    const tx: ethers.TransactionResponse = await retryWithBackoff(() =>
      hook.submitConsensusResult(
        consensus.resultHash,
        consensus.ilRiskIndex,
        BigInt(consensus.predictedILBps),
        consensus.recommendedFee,
        consensus.rebalanceSignal,
        consensus.yieldScore,
        BigInt(consensus.timestamp),
        consensus.signature,
      )
    )
    const receipt = await tx.wait()
    entry.txHash  = tx.hash
    entry.gasUsed = Number(receipt?.gasUsed ?? 0)
    entry.success = true
  } catch (e) {
    entry.error = String(e)
  }

  auditLog.push(entry)
  return entry
}

export function getAuditLog(): AuditEntry[] {
  return auditLog
}
