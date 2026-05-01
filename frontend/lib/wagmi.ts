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

export const wagmiConfig = createConfig({
  chains: [unichainSepolia],
  connectors: [
    injected(),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? '914c87ce0f063cd8ac455779a1271f13' }), //project ID
  ],
  transports: { [unichainSepolia.id]: http() },
})
