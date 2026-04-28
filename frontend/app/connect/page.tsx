'use client'
import dynamic from 'next/dynamic'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import NeuralHookLogo from '@/components/NeuralHookLogo'
import { unichainSepolia } from '@/lib/wagmi'

const P5NeuralNet = dynamic(() => import('@/components/P5NeuralNet'), { ssr: false })

export default function ConnectPage() {
  const { address, isConnected } = useAccount()
  const { connectors, connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const onWrongChain = isConnected && chainId !== unichainSepolia.id

  return (
    <main className="relative min-h-screen flex items-center justify-center pt-14">
      <P5NeuralNet intensity="calm" className="fixed inset-0 w-full h-full opacity-25" />
      <div className="fixed inset-0 pointer-events-none bg-black/70" />

      <div className="relative z-10 w-full max-w-md mx-6">
        <div className="card p-8 space-y-8">
          <div className="flex flex-col items-center gap-4">
            <NeuralHookLogo size={56} />
            <div className="text-center">
              <h1 className="font-mono font-black text-xl text-white tracking-widest uppercase">Connect Wallet</h1>
              <p className="font-mono text-xs text-[#555] mt-2">Unichain Sepolia · Chain ID 1301</p>
            </div>
          </div>

          {!isConnected ? (
            <div className="space-y-3">
              {connectors.map(connector => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  disabled={isPending}
                  className="btn-outline w-full text-xs py-3"
                >
                  {isPending ? 'Connecting…' : connector.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border border-[#222] rounded p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-[#555] uppercase">Address</span>
                  <span className="w-2 h-2 rounded-full bg-white" />
                </div>
                <span className="font-mono text-xs text-white break-all">{address}</span>
              </div>

              <div className="border border-[#222] rounded p-4">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-[#555] uppercase">Network</span>
                  {onWrongChain
                    ? <span className="font-mono text-[10px] text-[#888]">Wrong network</span>
                    : <span className="font-mono text-[10px] text-white">Unichain Sepolia ✓</span>}
                </div>
              </div>

              {onWrongChain && (
                <button
                  onClick={() => switchChain({ chainId: unichainSepolia.id })}
                  className="btn-primary w-full text-xs py-3"
                >
                  Switch to Unichain Sepolia
                </button>
              )}

              <button onClick={() => disconnect()} className="btn-outline w-full text-xs py-3">
                Disconnect
              </button>
            </div>
          )}

          <div className="border-t border-[#1a1a1a] pt-4">
            <p className="font-mono text-[10px] text-[#444] text-center leading-relaxed">
              NeuralHook operates on Unichain Sepolia testnet.<br />
              No mainnet assets are at risk.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
