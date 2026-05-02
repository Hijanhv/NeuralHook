'use client'
import type { WalletPosState } from '@/lib/hooks'

interface Props { walletPos: WalletPosState }

export default function LPPositions({ walletPos }: Props) {
  return (
    <div className="card p-5 space-y-3">
      <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Your LP Positions</span>

      {!walletPos.connected && (
        <div className="font-mono text-xs py-6 text-center" style={{ color: 'var(--text-muted)' }}>
          Connect wallet to view your positions
        </div>
      )}

      {walletPos.connected && !walletPos.hasPosition && (
        <div className="font-mono text-xs py-6 text-center space-y-1" style={{ color: 'var(--text-muted)' }}>
          <div>No active position in ETH/USDC pool</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Add liquidity to be protected by NeuralHook</div>
        </div>
      )}

      {walletPos.connected && walletPos.hasPosition && walletPos.position && (
        <div className="rounded p-3 space-y-3" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs" style={{ color: 'var(--text)' }}>{walletPos.position.id}</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>active</span>
          </div>
          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Tick Range</div>
              <div style={{ color: 'var(--text)' }}>{walletPos.position.tickLower} / {walletPos.position.tickUpper}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Entry sqrtPrice</div>
              <div style={{ color: 'var(--text)' }}>{walletPos.position.entryPrice.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>Position Value</div>
              <div style={{ color: 'var(--text)' }}>{walletPos.position.positionValue.toFixed(4)} ETH</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>IL Protection</div>
              <div style={{ color: '#22C55E' }}>Active · &gt;0.2% covered</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
