'use client'
import { useReadContract } from 'wagmi'
import { HOOK_ADDRESS, HOOK_ABI, isDeployed } from '@/lib/contracts'
import type { ConsensusResult } from '@/lib/types'

interface Props {
  lastConsensus: ConsensusResult | null
  lastUpdate: number | null
}

export default function CryptoProof({ lastConsensus, lastUpdate }: Props) {
  const deployed = isDeployed()
  const { data: trustedOracle } = useReadContract({
    address: HOOK_ADDRESS,
    abi: HOOK_ABI,
    functionName: 'trustedOracle',
    query: { enabled: deployed, refetchInterval: 60000 },
  })

  const sig = lastConsensus?.signature ?? null
  const sigShort = sig ? `${sig.slice(0, 12)}…${sig.slice(-10)}` : null
  const oracle = trustedOracle as string | undefined
  const verified = !!sig && !!oracle

  return (
    <div className="card p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Cryptographic Proof
        </span>
        <span className="font-mono text-xs flex items-center gap-1.5"
          style={{ color: verified ? '#22C55E' : 'var(--border-mid)' }}>
          {verified ? '✓ Verified on-chain' : '— awaiting data'}
        </span>
      </div>

      {/* Signature */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Oracle Signature (last consensus)
        </div>
        <div className="font-mono text-[11px] break-all leading-5"
          style={{ color: sig ? 'var(--text)' : 'var(--text-muted)' }}>
          {sigShort ?? '—'}
        </div>
      </div>

      {/* Oracle address */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Signer · trustedOracle (from contract)
        </div>
        <div className="font-mono text-[11px] break-all leading-5"
          style={{ color: oracle ? '#22C55E' : 'var(--text-muted)' }}>
          {oracle ?? '—'}
        </div>
      </div>

      {/* Method */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
        <div className="font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Verification method
        </div>
        <code className="font-mono text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>
          ECDSA.recover(resultHash, sig) == trustedOracle
        </code>
        <p className="font-mono text-[10px] mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
          Checked atomically inside beforeSwap — reverts on mismatch
        </p>
      </div>

      {/* Last verified */}
      {lastUpdate && lastUpdate > 0 && (
        <div className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
          Last verified{' '}
          <span style={{ color: 'var(--text)' }}>
            {new Date(lastUpdate * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          {' '}· Unichain Sepolia
        </div>
      )}
    </div>
  )
}
