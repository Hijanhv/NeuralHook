'use client'
import { useState, useEffect } from 'react'
import { useOnChainFundStats } from '@/lib/hooks'

export default function InsuranceFund() {
  const chain = useOnChainFundStats()

  // Mock that ticks when chain data isn't available
  const [mock, setMock] = useState({ balance: 2.84, totalClaimed: 1.12, claimCount: 47 })
  useEffect(() => {
    if (chain.deployed) return
    const id = setInterval(() => {
      setMock(s => ({ ...s, balance: +(s.balance + (Math.random() - 0.5) * 0.01).toFixed(4) }))
    }, 5000)
    return () => clearInterval(id)
  }, [chain.deployed])

  const balance      = chain.balance      ?? mock.balance
  const totalClaimed = chain.totalClaimed ?? mock.totalClaimed
  const claimCount   = chain.claimCount   ?? mock.claimCount
  const utilized     = (totalClaimed / (balance + totalClaimed)) * 100

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#666]">IL Insurance Fund</span>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${chain.deployed ? 'bg-white' : 'bg-[#444]'}`} />
          <span className="text-[10px] font-mono text-[#444]">{chain.deployed ? 'on-chain' : 'simulated'}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Balance',  value: `${balance.toFixed(3)} ETH` },
          { label: 'Claimed',  value: `${totalClaimed.toFixed(3)} ETH` },
          { label: 'Claims',   value: claimCount },
        ].map(item => (
          <div key={item.label}>
            <div className="text-[10px] font-mono text-[#555] uppercase">{item.label}</div>
            <div className="font-mono font-bold text-white text-sm mt-1">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono text-[#555]">
          <span>Fund Utilization</span>
          <span>{utilized.toFixed(1)}%</span>
        </div>
        <div className="h-1 bg-[#1a1a1a] rounded overflow-hidden">
          <div className="h-full bg-white/70 rounded transition-all duration-1000" style={{ width: `${Math.min(utilized, 100)}%` }} />
        </div>
      </div>

      <p className="text-[10px] font-mono text-[#444]">
        10% max drain per claim · auto-paid on remove-liquidity · ETH-denominated
      </p>
    </div>
  )
}
