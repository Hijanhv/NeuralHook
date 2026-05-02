import { createConfig, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { defineChain } from 'viem'

export const unichainSepolia = defineChain({
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia.unichain.org'] } },
  blockExplorers: { default: { name: 'Unichain Explorer', url: 'https://sepolia.uniscan.xyz' } },
  testnet: true,
})

// Explicit MetaMask connector — survives multi-wallet environments
const metaMask = injected({
  target: {
    id: 'metaMask',
    name: 'MetaMask',
    provider() {
      if (typeof window === 'undefined') return undefined
      const eth = (window as Window & { ethereum?: { isMetaMask?: boolean; providers?: { isMetaMask?: boolean }[] } }).ethereum
      if (eth?.isMetaMask) return eth as never
      return eth?.providers?.find(p => p.isMetaMask) as never
    },
  },
})

// Phantom EVM connector — Phantom injects at window.phantom.ethereum
const phantom = injected({
  target: {
    id: 'phantom',
    name: 'Phantom',
    provider() {
      if (typeof window === 'undefined') return undefined
      return (window as Window & { phantom?: { ethereum?: unknown } }).phantom?.ethereum as never
    },
  },
})

export const wagmiConfig = createConfig({
  chains: [unichainSepolia],
  connectors: [
    metaMask,
    phantom,
    injected(),            // generic fallback (Rabby, Frame, injected wallets)
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'demo' }),
  ],
  transports: { [unichainSepolia.id]: http() },
})
