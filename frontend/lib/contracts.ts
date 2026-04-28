// Contract addresses — set NEXT_PUBLIC_HOOK_ADDRESS and NEXT_PUBLIC_FUND_ADDRESS after deploy
export const HOOK_ADDRESS  = (process.env.NEXT_PUBLIC_HOOK_ADDRESS  ?? '0x0000000000000000000000000000000000000000') as `0x${string}`
export const FUND_ADDRESS  = (process.env.NEXT_PUBLIC_FUND_ADDRESS  ?? '0x0000000000000000000000000000000000000000') as `0x${string}`

export const HOOK_ABI = [
  { name: 'currentFee',           type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24' }] },
  { name: 'currentRisk',          type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8'  }] },
  { name: 'lastUpdateTimestamp',  type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256'}] },
  { name: 'trustedOracle',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address'}] },
  { name: 'paused',               type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool'   }] },
  { name: 'FEE_LOW',              type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24' }] },
  { name: 'FEE_MEDIUM',           type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24' }] },
  { name: 'FEE_HIGH',             type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24' }] },
  { name: 'FEE_CRITICAL',         type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24' }] },
  {
    name: 'computeIL', type: 'function', stateMutability: 'pure',
    inputs: [{ name: 'entrySqrtPrice', type: 'uint256' }, { name: 'exitSqrtPrice', type: 'uint256' }],
    outputs: [{ name: 'ilBps', type: 'uint256' }],
  },
] as const

export const FUND_ABI = [
  { name: 'balance',        type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalDeposited', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalClaimed',   type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'claimCount',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'paused',         type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool'    }] },
] as const

export const RISK_LABELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
export type  OnChainRisk = typeof RISK_LABELS[number]

export function isDeployed() {
  return HOOK_ADDRESS !== '0x0000000000000000000000000000000000000000'
}
