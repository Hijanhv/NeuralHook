'use client'
import type { LPPosition } from '@/lib/types'
import ILRiskBadge from './ILRiskBadge'

interface Props { positions: LPPosition[] }

export default function LPPositions({ positions }: Props) {
  return (
    <div className="card p-5 space-y-3">
      <span className="text-[10px] font-mono uppercase tracking-widest text-[#666]">Your LP Positions</span>
      {positions.length === 0 && (
        <div className="text-[#444] font-mono text-xs py-4 text-center">No active positions</div>
      )}
      <div className="space-y-2">
        {positions.map(pos => (
          <div key={pos.id} className="border border-[#1a1a1a] rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-white">{pos.id}</span>
              <ILRiskBadge risk={pos.ilRisk} size="sm" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
              <div>
                <div className="text-[#555]">Ticks</div>
                <div className="text-white">{pos.tickLower} / {pos.tickUpper}</div>
              </div>
              <div>
                <div className="text-[#555]">IL</div>
                <div className="text-white">{pos.currentIL.toFixed(2)}%</div>
              </div>
              <div>
                <div className="text-[#555]">Claimable</div>
                <div className="text-white">${pos.claimableInsurance}</div>
              </div>
            </div>
            {pos.claimableInsurance > 0 && (
              <div className="text-[10px] font-mono text-[#555] border border-[#1a1a1a] rounded px-2 py-1 text-center">
                ~${pos.claimableInsurance} auto-paid on remove liquidity
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
