'use client'
import type { ConsensusResult } from '@/lib/types'
import ILRiskBadge from './ILRiskBadge'

interface Props { history: ConsensusResult[] }

export default function ConsensusFeed({ history }: Props) {
  const recent = history.slice(-8).reverse()

  return (
    <div className="card p-5 space-y-3">
      <span className="text-[10px] font-mono uppercase tracking-widest text-[#666]">Consensus Feed</span>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {recent.length === 0 && (
          <div className="text-[#444] font-mono text-xs py-4 text-center">Awaiting consensus...</div>
        )}
        {recent.map((r, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0">
            <div className="flex items-center gap-3">
              <ILRiskBadge risk={r.ilRisk} size="sm" />
              <span className="font-mono text-xs text-[#666]">{(r.recommendedFee / 100).toFixed(2)}% fee</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-[#444]">{r.agreementCount}/3</span>
              <span className="font-mono text-[10px] text-[#444]">
                {new Date(r.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
