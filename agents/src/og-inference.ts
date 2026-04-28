import { ethers } from 'ethers'
import { predictILRisk, ilRiskToFee } from './il-calculator.js'
import { IL_RISK_INDEX, FEE_BY_RISK, type InferenceResult, type ILRisk } from './types.js'

const ORACLE_PK   = process.env.ORACLE_PRIVATE_KEY ?? '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const HOOK_ADDR   = process.env.HOOK_ADDRESS        ?? '0x0000000000000000000000000000000000000001'
const CHAIN_ID    = BigInt(process.env.CHAIN_ID     ?? '1301')
const OG_ENDPOINT = process.env.OG_ENDPOINT

interface PoolMetrics {
  volatility: number
  tickProximity: number
  momentum: number
  sqrtPriceX96: bigint
}

async function callOGInference(metrics: PoolMetrics): Promise<ILRisk> {
  if (!OG_ENDPOINT) throw new Error('no OG_ENDPOINT')
  const res = await fetch(OG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metrics),
  })
  const data = await res.json() as { ilRisk: ILRisk }
  return data.ilRisk
}

function mockInference(metrics: PoolMetrics): ILRisk {
  return predictILRisk(metrics.volatility, metrics.tickProximity, metrics.momentum)
}

export async function runInference(metrics: PoolMetrics): Promise<InferenceResult> {
  let ilRisk: ILRisk
  try {
    ilRisk = await callOGInference(metrics)
  } catch {
    ilRisk = mockInference(metrics)
  }

  const predictedILBps = Math.round(metrics.volatility * 3000)
  const recommendedFee = ilRiskToFee(ilRisk)
  const rebalanceSignal = ilRisk === 'HIGH' || ilRisk === 'CRITICAL'
  const yieldScore     = Math.min(255, Math.round((1 - metrics.volatility) * 200))
  const timestamp      = Math.floor(Date.now() / 1000)
  const ilRiskIndex    = IL_RISK_INDEX[ilRisk]

  // Build the same hash the Solidity contract verifies
  const resultHash = ethers.keccak256(ethers.toUtf8Bytes(
    `${ilRisk}:${predictedILBps}:${recommendedFee}:${timestamp}`
  ))

  const message = ethers.solidityPackedKeccak256(
    ['bytes32','uint8','uint256','uint24','bool','uint8','uint256','uint256','address'],
    [resultHash, ilRiskIndex, BigInt(predictedILBps), recommendedFee,
     rebalanceSignal, yieldScore, BigInt(timestamp), CHAIN_ID, HOOK_ADDR]
  )
  const wallet = new ethers.Wallet(ORACLE_PK)
  const sig = await wallet.signMessage(ethers.getBytes(message))

  return {
    ilRisk, ilRiskIndex, predictedILBps, recommendedFee, rebalanceSignal,
    yieldScore, timestamp, resultHash, signature: sig,
  }
}
