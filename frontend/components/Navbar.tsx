'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import NeuralHookLogo from './NeuralHookLogo'

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/about', label: 'How it works' },
]

function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        style={{
          border: '1px solid var(--border-mid)',
          color: 'var(--text-mid)',
          fontSize: '0.75rem',
          letterSpacing: '0.08em',
          borderRadius: '4px',
        }}
        className="font-mono uppercase px-3 py-1.5 hover:border-[var(--text)] hover:text-[var(--text)] transition-colors"
      >
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    )
  }

  return (
    <button
      onClick={() =>
        connect(
          { connector: injected() },
          // Suppress "user rejected" from bubbling to the Next.js error overlay
          { onError: () => {} },
        )
      }
      disabled={isPending}
      className="btn-outline !py-1.5 !px-4 !text-xs disabled:opacity-40"
    >
      {isPending ? 'Connecting…' : 'Connect'}
    </button>
  )
}

export default function Navbar() {
  const path = usePathname()
  return (
    <nav
      style={{ borderBottom: '1px solid var(--border)', background: 'rgba(249,248,245,0.94)' }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md"
    >
      <div className="max-w-7xl mx-auto px-6 h-[64px] flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 select-none">
          <NeuralHookLogo size={38} />
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.25rem',
              color: 'var(--text)',
              letterSpacing: '-0.01em',
            }}
          >
            NeuralHook
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '0.8125rem',
                color: path === l.href ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: path === l.href ? 500 : 400,
                letterSpacing: '0.01em',
              }}
              className="hover:!text-[var(--text)] transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <WalletButton />
          {/* Launch App → dashboard (no wallet gate) */}
          <Link href="/dashboard" className="btn-primary !py-1.5 !px-5 !text-xs">
            Launch App
          </Link>
        </div>
      </div>
    </nav>
  )
}
