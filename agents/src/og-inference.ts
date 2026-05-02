import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import OpenAI from 'openai'
import { predictILRisk, ilRiskToFee } from './il-calculator.js'
import { IL_RISK_INDEX, type InferenceResult, type ILRisk } from './types.js'

// ── Config ────────────────────────────────────────────────────────────────────

const ORACLE_PK   = process.env.ORACLE_PRIVATE_KEY ?? '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const HOOK_ADDR   = process.env.HOOK_ADDRESS        ?? '0x0000000000000000000000000000000000000001'
const CHAIN_ID    = BigInt(process.env.CHAIN_ID     ?? '1301')

// 0G Compute Network config
// OG_PROVIDER_ADDRESS: the on-chain address of the inference provider you subscribe to.
// Known testnet provider: 0x69Eb5a0BD7d0f4bF39eD5CE9Bd3376c61863aE08
const OG_PROVIDER  = process.env.OG_PROVIDER_ADDRESS
const OG_PK        = process.env.OG_PRIVATE_KEY   // wallet that holds OG tokens for billing
const OG_RPC       = process.env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai'

// ── Pool metrics type ─────────────────────────────────────────────────────────

interface PoolMetrics {
  volatility: number      // rolling 30-period σ, 0–1
  tickProximity: number   // 0 = at boundary, 1 = dead center
  momentum: number        // 5-period signed momentum, −1 to 1
  sqrtPriceX96: bigint
}

// ── 0G Compute inference ──────────────────────────────────────────────────────

function buildPrompt(m: PoolMetrics): string {
  const score = (m.volatility * 0.5 + (1 - m.tickProximity) * 0.3 + Math.abs(m.momentum) * 0.2).toFixed(4)
  return `You are an impermanent loss risk classifier for a Uniswap v4 ETH/USDC pool on Unichain.

Pool metrics:
  volatility (30-period σ, 0–1): ${m.volatility.toFixed(4)}
  tick proximity (0=boundary, 1=center): ${m.tickProximity.toFixed(4)}
  momentum (5-period signed, −1 to 1): ${m.momentum.toFixed(4)}
  composite score: ${score}

Thresholds:
  LOW      if score < 0.20
  MEDIUM   if score < 0.45
  HIGH     if score < 0.70
  CRITICAL otherwise

Respond with exactly one word: LOW, MEDIUM, HIGH, or CRITICAL.`
}

function parseRisk(text: string): ILRisk {
  const t = text.trim().toUpperCase()
  if (t.includes('CRITICAL')) return 'CRITICAL'
  if (t.includes('HIGH'))     return 'HIGH'
  if (t.includes('MEDIUM'))   return 'MEDIUM'
  return 'LOW'
}

async function callOGInference(metrics: PoolMetrics): Promise<{ risk: ILRisk; chatId: string }> {
  if (!OG_PROVIDER || !OG_PK) throw new Error('OG_PROVIDER_ADDRESS or OG_PRIVATE_KEY not set')

  const provider = new ethers.JsonRpcProvider(OG_RPC)
  const wallet   = new ethers.Wallet(OG_PK, provider)
  const broker   = await createZGComputeNetworkBroker(wallet)

  const prompt = buildPrompt(metrics)
  const { endpoint, model } = await broker.inference.getServiceMetadata(OG_PROVIDER)
  const headers = await broker.inference.getRequestHeaders(OG_PROVIDER, prompt)

  const openai = new OpenAI({ baseURL: endpoint, apiKey: '' })
  const completion = await openai.chat.completions.create(
    { messages: [{ role: 'user', content: prompt }], model, max_tokens: 8, temperature: 0 },
    { headers: headers as unknown as Record<string, string> },
  )

  const text = completion.choices[0]?.message?.content ?? 'LOW'
  const chatId = completion.id

  // Settle the 0G billing for this inference call
  await broker.inference.processResponse(OG_PROVIDER, text, chatId).catch(() => {})

  return { risk: parseRisk(text), chatId }
}

// ── Local fallback (used when OG_PROVIDER not set or 0G call fails) ───────────

function localInference(metrics: PoolMetrics): ILRisk {
  return predictILRisk(metrics.volatility, metrics.tickProximity, metrics.momentum)
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runInference(metrics: PoolMetrics): Promise<InferenceResult> {
  const using0G = !!(OG_PROVIDER && OG_PK)
  let ilRisk: ILRisk
  let source: '0g' | 'local' = 'local'

  if (using0G) {
    try {
      const result = await callOGInference(metrics)
      ilRisk = result.risk
      source = '0g'
      console.log(`[og-inference] 0G Compute → ${ilRisk}`)
    } catch (e) {
      console.warn(`[og-inference] 0G failed (${(e as Error).message}), using local fallback`)
      ilRisk = localInference(metrics)
    }
  } else {
    ilRisk = localInference(metrics)
  }

  const predictedILBps  = Math.round(metrics.volatility * 3000)
  const recommendedFee  = ilRiskToFee(ilRisk)
  const rebalanceSignal = ilRisk === 'HIGH' || ilRisk === 'CRITICAL'
  const yieldScore      = Math.min(255, Math.round((1 - metrics.volatility) * 200))
  const timestamp       = Math.floor(Date.now() / 1000)
  const ilRiskIndex     = IL_RISK_INDEX[ilRisk]

  // Build the same hash structure NeuralHook.sol verifies
  const resultHash = ethers.keccak256(ethers.toUtf8Bytes(
    `${ilRisk}:${predictedILBps}:${recommendedFee}:${timestamp}`,
  ))
  const message = ethers.solidityPackedKeccak256(
    ['bytes32', 'uint8', 'uint256', 'uint24', 'bool', 'uint8', 'uint256', 'uint256', 'address'],
    [resultHash, ilRiskIndex, BigInt(predictedILBps), recommendedFee,
     rebalanceSignal, yieldScore, BigInt(timestamp), CHAIN_ID, HOOK_ADDR],
  )
  const wallet = new ethers.Wallet(ORACLE_PK)
  const signature = await wallet.signMessage(ethers.getBytes(message))

  return {
    ilRisk, ilRiskIndex, predictedILBps, recommendedFee, rebalanceSignal,
    yieldScore, timestamp, resultHash, signature,
    inferenceSource: source,
  }
}
