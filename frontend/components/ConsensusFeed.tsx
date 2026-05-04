'use client'
import type { ConsensusResult } from '@/lib/types'
import ILRiskBadge from './ILRiskBadge'

interface Props { history: ConsensusResult[] }

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3">
        <div className="h-5 w-16 rounded animate-pulse" style={{ background: 'var(--border)' }} />
        <div className="h-3 w-14 rounded animate-pulse" style={{ background: 'var(--border)' }} />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-3 w-6 rounded animate-pulse" style={{ background: 'var(--border)' }} />
        <div className="h-3 w-12 rounded animate-pulse" style={{ background: 'var(--border)' }} />
      </div>
    </div>
  )
}

export default function ConsensusFeed({ history }: Props) {
  const recent = history.slice(-8).reverse()
  const loading = history.length === 0

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Consensus Feed
        </span>
        {!loading && (
          <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            {history.length} rounds
          </span>
        )}
      </div>

      <div className="space-y-0 max-h-64 overflow-y-auto">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          : recent.map((r, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <ILRiskBadge risk={r.ilRisk} size="sm" />
                  <span className="font-mono text-xs" style={{ color: 'var(--text-mid)' }}>
                    {(r.recommendedFee / 10000).toFixed(2)}% fee
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs" style={{ color: r.agreementCount >= 2 ? '#22C55E' : 'var(--text-muted)' }}>
                    {r.agreementCount}/3
                  </span>
                  <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(r.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              {r.rebalanceQuote && (
                <div className="pb-1 pl-1 font-mono text-[10px] flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <span style={{ color: '#F59E0B' }}>↻</span>
                  <span>
                    Uniswap quote: 1 ETH → ${r.rebalanceQuote.priceETHUSD.toFixed(0)} USDC
                    {r.rebalanceQuote.priceImpactPct > 0 && ` · ${r.rebalanceQuote.priceImpactPct.toFixed(3)}% impact`}
                    {' · '}<span style={{ opacity: 0.6 }}>{r.rebalanceQuote.route.split(' ')[0]}</span>
                  </span>
                </div>
              )}
              {r.swapExecution && (
                <div className="pb-2 pl-1 font-mono text-[10px] flex items-center gap-2" style={{ color: '#22C55E' }}>
                  <span>✓</span>
                  <span>
                    Swap executed on-chain ·{' '}
                    <a
                      href={`https://${r.swapExecution.chainId === 8453 ? 'basescan.org' : 'etherscan.io'}/tx/${r.swapExecution.txHash}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ textDecoration: 'underline', color: '#22C55E' }}
                    >
                      {r.swapExecution.txHash.slice(0, 10)}…
                    </a>
                    {' '}· {Number(r.swapExecution.amountInWei) / 1e18} ETH
                  </span>
                </div>
              )}
            </div>
          ))
        }
      </div>
    </div>
  )
}
