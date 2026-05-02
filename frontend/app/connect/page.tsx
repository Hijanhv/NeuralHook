'use client'
import dynamic from 'next/dynamic'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import NeuralHookLogo from '@/components/NeuralHookLogo'
import { unichainSepolia } from '@/lib/wagmi'

const P5NeuralNet = dynamic(() => import('@/components/P5NeuralNet'), { ssr: false })

// SVG icons for wallets
function MetaMaskIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 212 189" fill="none">
      <path d="M201.4 0L116.7 63.9l15.5-36.7L201.4 0z" fill="#E17726" stroke="#E17726" strokeWidth="0.25"/>
      <path d="M10.6 0l84 64.5-14.8-37.3L10.6 0z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M172 136.3l-22.6 34.6 48.4 13.3 13.9-47.2L172 136.3z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M0.4 137l13.8 47.2L62.5 171l-22.6-34.7L0.4 137z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M59.9 82.2L46.4 103l47.2 2.1-1.6-50.8L59.9 82.2z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M152.1 82.2l-32.5-28.5-1 51.4 47.2-2.1L152.1 82.2z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M62.5 171l28.3-13.6-24.4-19L62.5 171z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
      <path d="M121.2 157.4l28.2 13.6-3.8-32.6L121.2 157.4z" fill="#E27625" stroke="#E27625" strokeWidth="0.25"/>
    </svg>
  )
}

function PhantomIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 128 128" fill="none">
      <rect width="128" height="128" rx="28" fill="#AB9FF2"/>
      <path d="M110.6 64c0 25.7-20.8 46.5-46.6 46.5S17.4 89.7 17.4 64 38.3 17.5 64 17.5 110.6 38.3 110.6 64z" fill="#fff"/>
      <path d="M84.6 52.4H72.3c-1.1 0-2 .9-2 2v22.1c0 1.1.9 2 2 2h12.3c1.1 0 2-.9 2-2V54.4c0-1.1-.9-2-2-2z" fill="#AB9FF2"/>
      <path d="M56.7 52.4H44.4c-1.1 0-2 .9-2 2v22.1c0 1.1.9 2 2 2h12.3c1.1 0 2-.9 2-2V54.4c0-1.1-.9-2-2-2z" fill="#AB9FF2"/>
    </svg>
  )
}

function GenericWalletIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" strokeLinecap="round"/>
      <path d="M16 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"/>
    </svg>
  )
}

function walletIcon(id: string) {
  if (id === 'metaMask') return <MetaMaskIcon />
  if (id === 'phantom')  return <PhantomIcon />
  return <GenericWalletIcon />
}

export default function ConnectPage() {
  const { address, isConnected } = useAccount()
  const { connectors, connect, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const onWrongChain = isConnected && chainId !== unichainSepolia.id

  // De-duplicate connectors — injected() is generic fallback, skip if MetaMask/Phantom already present
  const namedIds = new Set(['metaMask', 'phantom'])
  const hasNamed = connectors.some(c => namedIds.has(c.id))
  const displayConnectors = connectors.filter(c =>
    c.id !== 'injected' || !hasNamed
  )

  // Friendly message for common errors
  const errMsg = (() => {
    if (!error) return null
    const msg = error.message ?? ''
    if (msg.includes('rejected') || msg.includes('denied') || msg.includes('4001')) return null
    if (msg.includes('not found') || msg.includes('not installed')) return 'Wallet extension not found — install it and refresh.'
    return 'Connection failed. Try again.'
  })()

  return (
    <main
      className="relative min-h-screen flex items-center justify-center pt-[92px]"
      style={{ background: 'var(--bg)' }}
    >
      <P5NeuralNet intensity="calm" className="fixed inset-0 w-full h-full opacity-[0.06]" />

      <div className="relative z-10 w-full max-w-lg mx-6 pb-16">
        {/* Header */}
        <div className="text-center mb-10">
          <NeuralHookLogo size={44} className="mx-auto mb-4" />
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--text)' }}>
            Connect your wallet
          </h1>
          <p className="font-mono text-[13px] tracking-widest uppercase mt-2" style={{ color: 'var(--text-muted)' }}>
            Unichain Sepolia · Chain ID 1301
          </p>
        </div>

        {!isConnected ? (
          <>
            {/* Wallet buttons */}
            <div className="space-y-2 mb-8">
              {errMsg && (
                <p className="font-mono text-[13px] px-1 pb-2" style={{ color: '#D97706' }}>{errMsg}</p>
              )}
              {displayConnectors.map(connector => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector }, { onError: () => {} })}
                  disabled={isPending}
                  className="w-full flex items-center gap-4 px-5 py-4 transition-all disabled:opacity-40 group"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-mid)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
                >
                  <span className="flex-shrink-0">{walletIcon(connector.id)}</span>
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text)' }}>
                    {connector.name}
                  </span>
                  <span className="ml-auto font-mono text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
                </button>
              ))}
            </div>

            {/* Why Unichain — information box */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '1.25rem 1.5rem' }}>
              <p className="font-mono text-xs tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
                Why Unichain, not Ethereum?
              </p>
              <div className="space-y-2">
                {[
                  { q: 'Uniswap v4 lives here', a: 'NeuralHook uses the Uniswap v4 PoolManager — deployed on Unichain Sepolia (chain 1301), not Ethereum mainnet yet.' },
                  { q: 'Gas cost', a: 'The hook fires on every swap. On Unichain (OP Stack L2), each tx costs ~$0.001. On Ethereum mainnet it would cost $5–50 — making the fee update economically impossible.' },
                  { q: 'Any EVM wallet works', a: 'MetaMask, Phantom, and any injected wallet connect to Unichain Sepolia by switching the network. No new wallet needed.' },
                ].map(item => (
                  <div key={item.q}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)' }}>{item.q} — </span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-mid)' }}>{item.a}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {/* Connected state */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '1.25rem 1.5rem' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Connected</span>
                <span className="w-2 h-2 rounded-full" style={{ background: '#22C55E' }} />
              </div>
              <p className="font-mono text-xs break-all" style={{ color: 'var(--text)' }}>{address}</p>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '1rem 1.5rem' }}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Network</span>
                {onWrongChain
                  ? <span className="font-mono text-xs" style={{ color: '#F59E0B' }}>Wrong network</span>
                  : <span className="font-mono text-xs" style={{ color: '#22C55E' }}>Unichain Sepolia ✓</span>}
              </div>
            </div>

            {onWrongChain && (
              <button
                onClick={() => switchChain({ chainId: unichainSepolia.id })}
                className="btn-primary w-full !py-3"
              >
                Switch to Unichain Sepolia
              </button>
            )}

            <button onClick={() => disconnect()} className="btn-outline w-full !py-3">
              Disconnect
            </button>

            <p className="font-mono text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>
              Unichain Sepolia testnet — no mainnet assets at risk
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
