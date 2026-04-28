'use client'
import { useState, useEffect, useCallback } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'
import type { AgentStatus, AuditEntry, ConsensusResult, PoolStats, LPPosition, ILRisk } from './types'
import { HOOK_ADDRESS, FUND_ADDRESS, HOOK_ABI, FUND_ABI, RISK_LABELS, isDeployed } from './contracts'

const AGENT_URLS = [
  process.env.NEXT_PUBLIC_AGENT_0 ?? 'http://localhost:4000',
  process.env.NEXT_PUBLIC_AGENT_1 ?? 'http://localhost:4001',
  process.env.NEXT_PUBLIC_AGENT_2 ?? 'http://localhost:4002',
]

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json() as Promise<T>
}

export function useAgentStatuses(pollMs = 5000) {
  const [statuses, setStatuses] = useState<AgentStatus[]>([])
  useEffect(() => {
    const tick = async () => {
      const results = await Promise.allSettled(
        AGENT_URLS.map((u, i) =>
          fetchJSON<AgentStatus>(`${u}/status`).then(s => ({ ...s, id: `agent-${i}` }))
        )
      )
      setStatuses(results.map((r, i) =>
        r.status === 'fulfilled'
          ? r.value
          : { id: `agent-${i}`, healthy: false, lastConsensus: 0, voteCount: 0, inferenceCount: 0, uptime: 0 }
      ))
    }
    tick()
    const id = setInterval(tick, pollMs)
    return () => clearInterval(id)
  }, [pollMs])
  return statuses
}

export function useAgentHistory(agentIndex = 0, pollMs = 10000) {
  const [history, setHistory] = useState<ConsensusResult[]>([])
  useEffect(() => {
    const tick = () =>
      fetchJSON<ConsensusResult[]>(`${AGENT_URLS[agentIndex]}/history`)
        .then(setHistory)
        .catch(() => {})
    tick()
    const id = setInterval(tick, pollMs)
    return () => clearInterval(id)
  }, [agentIndex, pollMs])
  return history
}

export function useAuditLog(pollMs = 15000) {
  const [log, setLog] = useState<AuditEntry[]>([])
  useEffect(() => {
    const tick = () =>
      fetchJSON<AuditEntry[]>(`${AGENT_URLS[0]}/audit-log`)
        .then(setLog)
        .catch(() => {})
    tick()
    const id = setInterval(tick, pollMs)
    return () => clearInterval(id)
  }, [pollMs])
  return log
}

export function useTriggerVolatility() {
  const [loading, setLoading] = useState(false)
  const trigger = useCallback(async () => {
    setLoading(true)
    try {
      await fetch(`${AGENT_URLS[0]}/trigger-volatility`, { method: 'POST' })
    } finally {
      setLoading(false)
    }
  }, [])
  return { trigger, loading }
}

export function useDerivedStats(history: ConsensusResult[]) {
  if (!history.length) return { avgFee: 0, riskDist: {} as Record<string, number>, consensusRate: 0 }
  const avgFee = history.reduce((s, h) => s + h.recommendedFee, 0) / history.length
  const riskDist: Record<string, number> = {}
  for (const h of history) riskDist[h.ilRisk] = (riskDist[h.ilRisk] ?? 0) + 1
  const consensusRate = history.filter(h => h.agreementCount >= 2).length / history.length
  return { avgFee, riskDist, consensusRate }
}

export function useMockPoolStats(): PoolStats {
  const [stats, setStats] = useState<PoolStats>({
    tvl: 4_200_000, volume24h: 820_000, fee24h: 2460, currentTick: -887220,
    sqrtPriceX96: '79228162514264337593543950336', ilProtected: 1_340_000,
  })
  useEffect(() => {
    const id = setInterval(() => {
      setStats(s => ({
        ...s,
        tvl: s.tvl + (Math.random() - 0.5) * 50000,
        volume24h: s.volume24h + (Math.random() - 0.5) * 10000,
        fee24h: s.fee24h + (Math.random() - 0.5) * 100,
        currentTick: s.currentTick + Math.round((Math.random() - 0.5) * 10),
      }))
    }, 3000)
    return () => clearInterval(id)
  }, [])
  return stats
}

const MOCK_RISKS = ['LOW', 'LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
const MOCK_FEES  = [500, 500, 3000, 3000, 7500, 10000]

function makeMockConsensus(i: number): ConsensusResult {
  const riskIdx = Math.floor(Math.random() * MOCK_RISKS.length)
  const risk = MOCK_RISKS[riskIdx]
  return {
    ilRisk: risk,
    predictedILBps: Math.round(Math.random() * 2000),
    recommendedFee: MOCK_FEES[riskIdx],
    rebalanceSignal: riskIdx >= 4,
    yieldScore: Math.floor(Math.random() * 200),
    timestamp: Math.floor((Date.now() - (20 - i) * 35000) / 1000),
    signature: '0x' + 'ab'.repeat(32) + '1c',
    signerAgentId: `agent-${i % 3}`,
    agreementCount: 2 + (Math.random() > 0.5 ? 1 : 0),
  }
}

export function useMockConsensusHistory(): ConsensusResult[] {
  const [history, setHistory] = useState<ConsensusResult[]>(() =>
    Array.from({ length: 12 }, (_, i) => makeMockConsensus(i))
  )
  useEffect(() => {
    const id = setInterval(() => {
      setHistory(prev => [...prev.slice(-19), makeMockConsensus(prev.length)])
    }, 8000)
    return () => clearInterval(id)
  }, [])
  return history
}

export function useMockPositions(): LPPosition[] {
  return [
    { id: '0x1a2b', tickLower: -887220, tickUpper: -880000, liquidity: '1234567890', entryPrice: 1820, currentIL: 1.2, ilRisk: 'LOW', claimableInsurance: 0 },
    { id: '0x3c4d', tickLower: -880000, tickUpper: -870000, liquidity: '987654321', entryPrice: 1750, currentIL: 5.8, ilRisk: 'MEDIUM', claimableInsurance: 290 },
    { id: '0x5e6f', tickLower: -870000, tickUpper: -860000, liquidity: '456789012', entryPrice: 1680, currentIL: 14.3, ilRisk: 'HIGH', claimableInsurance: 715 },
  ]
}

// ── On-chain reads (only active when contract is deployed) ────────────────────

export function useOnChainHookState() {
  const deployed = isDeployed()
  const { data, isLoading } = useReadContracts({
    contracts: [
      { address: HOOK_ADDRESS, abi: HOOK_ABI, functionName: 'currentFee' },
      { address: HOOK_ADDRESS, abi: HOOK_ABI, functionName: 'currentRisk' },
      { address: HOOK_ADDRESS, abi: HOOK_ABI, functionName: 'lastUpdateTimestamp' },
      { address: HOOK_ADDRESS, abi: HOOK_ABI, functionName: 'paused' },
    ],
    query: { enabled: deployed, refetchInterval: 5000 },
  })

  if (!deployed || !data) return { deployed: false, isLoading, currentFee: null, currentRisk: null, lastUpdate: null, paused: false }

  const fee       = data[0].status === 'success' ? Number(data[0].result) : null
  const riskIndex = data[1].status === 'success' ? Number(data[1].result) : null
  const lastUpdate = data[2].status === 'success' ? Number(data[2].result) : null
  const paused    = data[3].status === 'success' ? Boolean(data[3].result) : false
  const risk: ILRisk | null = riskIndex !== null ? (RISK_LABELS[riskIndex] ?? null) : null

  return { deployed: true, isLoading, currentFee: fee, currentRisk: risk, lastUpdate, paused }
}

export function useOnChainFundStats() {
  const deployed = isDeployed()
  const { data, isLoading } = useReadContracts({
    contracts: [
      { address: FUND_ADDRESS, abi: FUND_ABI, functionName: 'balance' },
      { address: FUND_ADDRESS, abi: FUND_ABI, functionName: 'totalDeposited' },
      { address: FUND_ADDRESS, abi: FUND_ABI, functionName: 'totalClaimed' },
      { address: FUND_ADDRESS, abi: FUND_ABI, functionName: 'claimCount' },
    ],
    query: { enabled: deployed, refetchInterval: 10000 },
  })

  if (!deployed || !data) return { deployed: false, isLoading, balance: null, totalDeposited: null, totalClaimed: null, claimCount: null }

  const toEth = (v: bigint | undefined) => v !== undefined ? Number(v) / 1e18 : null

  return {
    deployed: true,
    isLoading,
    balance:        data[0].status === 'success' ? toEth(data[0].result as bigint) : null,
    totalDeposited: data[1].status === 'success' ? toEth(data[1].result as bigint) : null,
    totalClaimed:   data[2].status === 'success' ? toEth(data[2].result as bigint) : null,
    claimCount:     data[3].status === 'success' ? Number(data[3].result as bigint) : null,
  }
}
