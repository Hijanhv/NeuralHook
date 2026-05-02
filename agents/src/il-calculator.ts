import type { ILRisk } from './types.js'

export function computeILBps(entrySqrtPrice: bigint, exitSqrtPrice: bigint): number {
  if (entrySqrtPrice === 0n || exitSqrtPrice === 0n) return 0
  const SCALE = 10n ** 18n
  const larger  = entrySqrtPrice > exitSqrtPrice ? entrySqrtPrice : exitSqrtPrice
  const smaller = entrySqrtPrice > exitSqrtPrice ? exitSqrtPrice  : entrySqrtPrice
  const q  = (larger * SCALE) / smaller
  const q2 = (q * q) / SCALE
  const num = 2n * q
  const den = SCALE + q2
  const ratio = (num * SCALE) / den
  if (ratio >= SCALE) return 0
  const il = SCALE - ratio
  return Number((il * 10000n) / SCALE)
}

export function predictILRisk(
  volatility: number,    // rolling 30-period σ (0–1)
  tickProximity: number, // 0 = at boundary, 1 = dead center
  momentum: number,      // 5-period signed momentum (–1 to 1)
): ILRisk {
  const score = volatility * 0.5 + (1 - tickProximity) * 0.3 + Math.abs(momentum) * 0.2

  if (score < 0.20) return 'LOW'
  if (score < 0.45) return 'MEDIUM'
  if (score < 0.70) return 'HIGH'
  return 'CRITICAL'
}

export function ilBpsToRisk(ilBps: number): ILRisk {
  if (ilBps < 100)  return 'LOW'
  if (ilBps < 500)  return 'MEDIUM'
  if (ilBps < 1500) return 'HIGH'
  return 'CRITICAL'
}

export function ilRiskToFee(risk: ILRisk): number {
  const fees: Record<ILRisk, number> = { LOW: 500, MEDIUM: 3000, HIGH: 7500, CRITICAL: 10000 }
  return fees[risk]
}

export function estimateFeeCompensation(ilBps: number, fee: number, volume: number): number {
  return (volume * fee) / 10000 - (volume * ilBps) / 20000
}

// Simulate pool metrics for testing (no live RPC)
export function simulatePoolMetrics(): {
  volatility: number; tickProximity: number; momentum: number; sqrtPriceX96: bigint
} {
  const baseVol = 0.15 + Math.random() * 0.1
  const spike   = Math.random() < 0.05 ? Math.random() * 0.6 : 0
  return {
    volatility:    Math.min(baseVol + spike, 1),
    tickProximity: 0.3 + Math.random() * 0.4,
    momentum:      (Math.random() - 0.5) * 0.5,
    // token0=ETH(18dec), token1=USDC(6dec) — base ≈ $2000/ETH, ±1% swing
    sqrtPriceX96:  3543191142285914205922034n +
                   BigInt(Math.round((Math.random() - 0.5) * 3.54e22)),
  }
}
