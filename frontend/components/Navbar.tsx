'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import NeuralHookLogo from './NeuralHookLogo'

const links = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/about', label: 'About' },
]

function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="font-mono text-[10px] uppercase tracking-widest border border-[#333] px-3 py-1.5 text-white hover:border-white transition-colors"
      >
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    )
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      disabled={isPending}
      className="font-mono text-[10px] uppercase tracking-widest border border-[#444] px-3 py-1.5 text-[#888] hover:border-white hover:text-white transition-colors disabled:opacity-40"
    >
      {isPending ? 'Connecting…' : 'Connect'}
    </button>
  )
}

export default function Navbar() {
  const path = usePathname()
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#222] bg-black/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <NeuralHookLogo size={32} />
          <span className="font-mono font-bold tracking-widest text-white text-sm uppercase">NeuralHook</span>
        </Link>

        <div className="flex items-center gap-6">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`font-mono text-xs uppercase tracking-widest transition-colors ${
                path === l.href ? 'text-white' : 'text-[#666] hover:text-white'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <WalletButton />
        </div>
      </div>
    </nav>
  )
}
