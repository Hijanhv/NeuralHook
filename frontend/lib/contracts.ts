import { keccak256, encodeAbiParameters } from 'viem'

// Contract addresses — set NEXT_PUBLIC_HOOK_ADDRESS and NEXT_PUBLIC_FUND_ADDRESS after deploy
export const HOOK_ADDRESS  = (process.env.NEXT_PUBLIC_HOOK_ADDRESS  ?? '0x0000000000000000000000000000000000000000') as `0x${string}`
export const FUND_ADDRESS  = (process.env.NEXT_PUBLIC_FUND_ADDRESS  ?? '0x0000000000000000000000000000000000000000') as `0x${string}`

export const HOOK_ABI = [
  { name: 'currentFee',           type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24' }] },
  { name: 'currentRisk',          type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8'  }] },
  { name: 'lastUpdateTimestamp',  type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256'}] },
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
  { name: 'IL_THRESHOLD_BPS', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'trustedOracle', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    name: 'entryPrices', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }, { name: 'lp', type: 'address' }],
    outputs: [{ type: 'uint160' }],
  },
  {
    name: 'entryTickLowers', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }, { name: 'lp', type: 'address' }],
    outputs: [{ type: 'int24' }],
  },
  {
    name: 'entryTickUppers', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }, { name: 'lp', type: 'address' }],
    outputs: [{ type: 'int24' }],
  },
  {
    name: 'positionValues', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }, { name: 'lp', type: 'address' }],
    outputs: [{ type: 'uint256' }],
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

export function computePoolId(): `0x${string}` {
  return keccak256(encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'address' },
      { type: 'uint24' },
      { type: 'int24' },
      { type: 'address' },
    ],
    [
      '0x0000000000000000000000000000000000000000',
      '0x31d0220469e10c4E71834a79b1f276d740d3768F',
      0x800000,
      60,
      HOOK_ADDRESS,
    ]
  ))
}

// sqrtPriceX96 to ETH/USDC price (ETH=18 decimals, USDC=6 decimals)
export function sqrtPriceX96ToPrice(sqrtPriceX96: string): number {
  const q96 = BigInt(2) ** BigInt(96)
  const sq = BigInt(sqrtPriceX96)
  // price = (sq/q96)^2 * 10^12 (decimals adjustment: 10^18/10^6)
  const num = sq * sq * BigInt(10) ** BigInt(12)
  const den = q96 * q96
  return Number(num / den)
}
