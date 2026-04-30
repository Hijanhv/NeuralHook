import { ethers } from 'ethers'
import type { ConsensusResult, AuditEntry } from './types.js'

//Addresses are gonna be overwritten by .env
const RPC_URL    = process.env.RPC_URL            ?? 'https://sepolia.unichain.org'
const PK         = process.env.PRIVATE_KEY        ?? '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const HOOK_ADDR  = process.env.HOOK_ADDRESS       ?? '0x0000000000000000000000000000000000000001'
const ORACLE_PK  = process.env.ORACLE_PRIVATE_KEY ?? '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const CHAIN_ID   = BigInt(process.env.CHAIN_ID    ?? '1301')

const HOOK_ABI = [
  'function submitConsensusResult(bytes32 resultHash, uint8 ilRisk, uint256 predictedILBps, uint24 recommendedFee, bool rebalanceSignal, uint8 yieldScore, uint256 timestamp, bytes calldata signature) external',
]

const auditLog: AuditEntry[] = []

// Serialize submissions: only one tx in flight at a time. Without this guard,
// a new cycle fires every 30s and tries to submit at the same nonce while the
// previous tx is still pending, queueing multiple txs that all go stale by the
// time they're mined (Unichain Sepolia can take 60s+ under contention).
let inFlight = false

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
      // Don't retry on nonce conflicts: the prior tx is already in the mempool, retrying spams the same error
      if ((e as { code?: string })?.code === 'REPLACEMENT_UNDERPRICED') throw e
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, baseDelayMs * 2 ** i))
    }
  }
  throw lastErr
}

export async function triggerRebalance(consensus: ConsensusResult): Promise<AuditEntry> {
  const entry: AuditEntry = {
    txHash:    '0x' + '0'.repeat(64),
    timestamp: Date.now(),
    action:    'submitConsensusResult',
    ilRisk:    consensus.ilRisk,
    fee:       consensus.recommendedFee,
    gasUsed:   0,
    success:   false,
  }

  if (inFlight) {
    entry.error = 'skipped: previous submission still in flight'
    auditLog.push(entry)
    return entry
  }
  inFlight = true

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet   = new ethers.Wallet(PK, provider)
  const hook     = new ethers.Contract(HOOK_ADDR, HOOK_ABI, wallet)

  // Re-sign with current timestamp so the submission stays within MAX_STALENESS (60s)
  const freshTs = BigInt(Math.floor(Date.now() / 1000))
  const msg = ethers.solidityPackedKeccak256(
    ['bytes32','uint8','uint256','uint24','bool','uint8','uint256','uint256','address'],
    [consensus.resultHash, consensus.ilRiskIndex, BigInt(consensus.predictedILBps),
     consensus.recommendedFee, consensus.rebalanceSignal, consensus.yieldScore,
     freshTs, CHAIN_ID, HOOK_ADDR]
  )
  const oracle = new ethers.Wallet(ORACLE_PK)
  const freshSig = await oracle.signMessage(ethers.getBytes(msg))

  let txResp: ethers.TransactionResponse | null = null
  try {
    txResp = await retryWithBackoff(() =>
      hook.submitConsensusResult(
        consensus.resultHash,
        consensus.ilRiskIndex,
        BigInt(consensus.predictedILBps),
        consensus.recommendedFee,
        consensus.rebalanceSignal,
        consensus.yieldScore,
        freshTs,
        freshSig,
        // 100 gwei base ensures fast inclusion on Unichain Sepolia so the tx is
        // mined well within MAX_STALENESS (60s). At lower gas, mining can take
        // longer than 60s and the tx reverts with StaleInference.
        { maxFeePerGas: 100_000_000_000n, maxPriorityFeePerGas: 20_000_000_000n }
      )
    )
    entry.txHash = txResp.hash  // capture immediately so we don't lose it on timeout
    // Bounded wait: if Unichain Sepolia drops the tx, tx.wait() can hang forever
    // and pin inFlight=true, freezing all future submissions
    const receipt = await Promise.race([
      txResp.wait(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('tx.wait timeout (120s) — tx likely dropped')), 120_000)
      ),
    ])
    entry.gasUsed = Number(receipt?.gasUsed ?? 0)
    entry.success = receipt?.status === 1
    if (!entry.success) entry.error = 'tx reverted on-chain'
  } catch (e) {
    entry.error = String(e)
    // If a ghost tx is blocking our nonce, burn it with a high-gas self-transfer
    // so the next cycle isn't stuck. Unichain Sepolia's mempool can hold dropped
    // txs for a while, blocking same-nonce retries at our normal gas price.
    if ((e as { code?: string })?.code === 'REPLACEMENT_UNDERPRICED') {
      try {
        const flushTx = await wallet.sendTransaction({
          to: wallet.address, value: 0, gasLimit: 21000n,
          maxFeePerGas: 200_000_000_000n,        // 200 gwei to override anything stuck
          maxPriorityFeePerGas: 50_000_000_000n,
        })
        await flushTx.wait()
        entry.error += ` | flushed nonce via ${flushTx.hash}`
      } catch (flushErr) {
        entry.error += ` | flush failed: ${String(flushErr).slice(0,80)}`
      }
    }
  } finally {
    inFlight = false
  }

  auditLog.push(entry)
  return entry
}

export function getAuditLog(): AuditEntry[] {
  return auditLog
}
