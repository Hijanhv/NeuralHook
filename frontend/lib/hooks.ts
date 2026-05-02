'use client'
import { useState, useEffect, useCallback } from 'react'
import { useReadContracts } from 'wagmi'
import { useAccount } from 'wagmi'
import type { AgentStatus, AuditEntry, ConsensusResult, ILRisk } from './types'
import { HOOK_ADDRESS, FUND_ADDRESS, HOOK_ABI, FUND_ABI, RISK_LABELS, isDeployed, computePoolId, sqrtPriceX96ToPrice } from './contracts'

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

// ── Wallet LP position from NeuralHook contract ───────────────────────────────

interface Position {
  id: string
  tickLower: number
  tickUpper: number
  entryPrice: number
  positionValue: number
  address: string
}

export interface WalletPosState {
  connected: boolean
  hasPosition: boolean
  position: Position | null
}

export function useWalletLPPosition(): WalletPosState {
  const { address } = useAccount()
  const deployed = isDeployed()
  const poolId = computePoolId()

  const zero = '0x0000000000000000000000000000000000000000' as `0x${string}`
  const lp = address ?? zero

  const { data } = useReadContracts({
    contracts: [
      { address: HOOK_ADDRESS, abi: HOOK_ABI, functionName: 'entryPrices',    args: [poolId, lp] },
      { address: HOOK_ADDRESS, abi: HOOK_ABI, functionName: 'entryTickLowers', args: [poolId, lp] },
      { address: HOOK_ADDRESS, abi: HOOK_ABI, functionName: 'entryTickUppers', args: [poolId, lp] },
      { address: HOOK_ADDRESS, abi: HOOK_ABI, functionName: 'positionValues',  args: [poolId, lp] },
    ],
    query: { enabled: deployed && !!address, refetchInterval: 10000 },
  })

  if (!address) return { connected: false, hasPosition: false, position: null }
  if (!data)    return { connected: true,  hasPosition: false, position: null }

  const entryPrice  = data[0].status === 'success' ? Number(data[0].result as bigint) : 0
  const tickLower   = data[1].status === 'success' ? Number(data[1].result) : 0
  const tickUpper   = data[2].status === 'success' ? Number(data[2].result) : 0
  const posValue    = data[3].status === 'success' ? Number(data[3].result as bigint) / 1e18 : 0

  if (entryPrice === 0) return { connected: true, hasPosition: false, position: null }

  return {
    connected: true,
    hasPosition: true,
    position: {
      id: address.slice(0, 6) + '…' + address.slice(-4),
      tickLower,
      tickUpper,
      entryPrice,
      positionValue: posValue,
      address,
    },
  }
}

// ── Fee/risk history chart data from real consensus ───────────────────────────

export function useFeeHistory(history: ConsensusResult[]): { t: number; fee: number; risk: number }[] {
  return history.map(r => ({
    t:    r.timestamp * 1000,
    fee:  r.recommendedFee,
    risk: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(r.ilRisk),
  }))
}
