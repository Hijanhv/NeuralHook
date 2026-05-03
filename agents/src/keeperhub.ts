import { ethers } from 'ethers'
import type { ConsensusResult, AuditEntry } from './types.js'

const RPC_URL   = process.env.RPC_URL      ?? 'https://sepolia.unichain.org'
const HOOK_ADDR = process.env.HOOK_ADDRESS ?? '0x0000000000000000000000000000000000000001'

const PK = process.env.PRIVATE_KEY
if (!PK) throw new Error('PRIVATE_KEY env var is required — set it in .env.local')
const SIGNER_PK: string = PK

const HOOK_ABI = [
  'function submitConsensusResult(bytes32 resultHash, uint8 ilRisk, uint256 predictedILBps, uint24 recommendedFee, bool rebalanceSignal, uint8 yieldScore, uint256 timestamp, bytes calldata signature) external',
  'event InferenceUpdated(uint8 ilRisk, uint24 fee, bool rebalanceSignal, uint256 timestamp)',
]

// Unichain Sepolia (OP Stack): blocks every ~1s, low priority fee near zero.
const GAS_OVERRIDES = {
  maxFeePerGas:         ethers.parseUnits('0.1', 'gwei'),
  maxPriorityFeePerGas: ethers.parseUnits('0.05', 'gwei'),
  gasLimit:             300_000n,
}

const auditLog: AuditEntry[] = []

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < maxAttempts; i++) {
    try { return await fn() } catch (e) {
      lastErr = e
      const isUnderprice = String(e).includes('REPLACEMENT_UNDERPRICED')
      if (isUnderprice) {
        GAS_OVERRIDES.maxFeePerGas         = GAS_OVERRIDES.maxFeePerGas * 12n / 10n
        GAS_OVERRIDES.maxPriorityFeePerGas = GAS_OVERRIDES.maxPriorityFeePerGas * 12n / 10n
        i--
        continue
      }
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, baseDelayMs * 2 ** i))
    }
  }
  throw lastErr
}

// Simulate a tx via eth_call before broadcasting — catches reverts ~200ms before wasting gas.
async function simulate(
  provider: ethers.JsonRpcProvider,
  wallet: ethers.Wallet,
  hook: ethers.Contract,
  consensus: ConsensusResult,
): Promise<void> {
  const calldata = hook.interface.encodeFunctionData('submitConsensusResult', [
    consensus.resultHash,
    consensus.ilRiskIndex,
    BigInt(consensus.predictedILBps),
    consensus.recommendedFee,
    consensus.rebalanceSignal,
    consensus.yieldScore,
    BigInt(consensus.timestamp),
    consensus.signature,
  ])
  await provider.call({ to: HOOK_ADDR, data: calldata, from: wallet.address })
}

export async function triggerRebalance(consensus: ConsensusResult): Promise<AuditEntry> {
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet   = new ethers.Wallet(SIGNER_PK, provider)
  const hook     = new ethers.Contract(HOOK_ADDR, HOOK_ABI, wallet)

  const entry: AuditEntry = {
    txHash:    '0x' + '0'.repeat(64),
    timestamp: Math.floor(Date.now() / 1000),
    action:    'submitConsensusResult',
    ilRisk:    consensus.ilRisk,
    fee:       consensus.recommendedFee,
    gasUsed:   0,
    success:   false,
  }

  try {
    // Simulate first — fast revert detection before sending real tx
    await simulate(provider, wallet, hook, consensus)
    console.log(`[keeperhub] simulation passed — broadcasting`)

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
        GAS_OVERRIDES,
      )
    )

    entry.txHash  = tx.hash
    entry.success = true
    console.log(`[keeperhub] tx broadcast: ${tx.hash} (${consensus.ilRisk} → ${(consensus.recommendedFee / 10000).toFixed(2)}% fee)`)

    tx.wait(1).then(receipt => {
      if (receipt) {
        entry.gasUsed = Number(receipt.gasUsed)
        console.log(`[keeperhub] confirmed in block ${receipt.blockNumber} · gas ${receipt.gasUsed}`)
      }
    }).catch(e => {
      entry.success = false
      entry.error   = String(e)
      console.error(`[keeperhub] tx failed post-broadcast: ${e}`)
    })

  } catch (e) {
    entry.error = String(e)
    console.error(`[keeperhub] submission failed: ${e}`)
  }

  auditLog.push(entry)
  if (auditLog.length > 200) auditLog.shift()
  return entry
}

const HOOK_READ_ABI = [
  'function lastUpdateTimestamp() view returns (uint256)',
  'function currentFee() view returns (uint24)',
  'function currentRisk() view returns (uint8)',
]

// Poll for on-chain state changes — Unichain Sepolia public RPC does not support
// eth_newFilter, so event subscriptions fail. Polling every 30s is sufficient.
export function startRebalanceListener(): void {
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const hook     = new ethers.Contract(HOOK_ADDR, HOOK_READ_ABI, provider)

  let lastSeen = 0n

  const poll = async () => {
    try {
      const ts: bigint = await hook.lastUpdateTimestamp()
      if (ts > lastSeen && ts > 0n) {
        const fee:  number = await hook.currentFee()
        const risk: number = await hook.currentRisk()
        console.log(`[keeperhub] on-chain state updated ✓ — risk=${risk} fee=${(fee / 10000).toFixed(2)}% ts=${ts}`)
        lastSeen = ts
      }
    } catch { /* RPC transient error, ignore */ }
  }

  setInterval(() => void poll(), 30_000)
  void poll()
  console.log(`[keeperhub] polling ${HOOK_ADDR} for state updates every 30s`)
}

export function getAuditLog(): AuditEntry[] {
  return auditLog
}
