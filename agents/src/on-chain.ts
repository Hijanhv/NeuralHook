import { ethers } from 'ethers'
import { keccak256, concat, zeroPadValue, toBeHex } from 'ethers'

const RPC_URL       = process.env.RPC_URL       ?? 'https://sepolia.unichain.org'
const HOOK_ADDRESS  = process.env.HOOK_ADDRESS  ?? '0x0000000000000000000000000000000000000000'
const POOL_MANAGER  = '0x00B036B58a818B1BC34d502D3fE730Db729e62AC'
const USDC          = '0x31d0220469e10c4E71834a79b1f276d740d3768F'

// POOLS_SLOT = 6  (StateLibrary constant in v4-core)
const POOLS_SLOT = zeroPadValue(toBeHex(6), 32)

const EXTSLOAD_ABI = [
  'function extsload(bytes32 slot) external view returns (bytes32)',
]

// sqrtPriceX96 bounds for $50–$50,000 ETH with token0=ETH(18dec), token1=USDC(6dec)
// price_raw = sq^2/q96^2; ethPrice = price_raw * 1e12
// sq_min = sqrt(50/1e12) * q96 ≈ 7.07e18
// sq_max = sqrt(50000/1e12) * q96 ≈ 2.24e26
const SQ_MIN = 7_071_067_811_865_475n          // ETH ≈ $50
const SQ_MAX = 223_606_797_749_978_969_640_917n // ETH ≈ $50,000

let _provider: ethers.JsonRpcProvider | null = null
function provider() {
  if (!_provider) _provider = new ethers.JsonRpcProvider(RPC_URL)
  return _provider
}

function poolStateSlot(poolId: string): string {
  return keccak256(concat([poolId, POOLS_SLOT]))
}

// poolId = keccak256(abi.encode(PoolKey)) — each field padded to 32 bytes
function computePoolId(): string {
  const pad = (v: string | number | bigint) => zeroPadValue(toBeHex(v), 32)
  return keccak256(concat([
    pad('0x0000000000000000000000000000000000000000'), // ETH (token0)
    pad(USDC),                                         // USDC (token1)
    pad(0x800000),                                     // DYNAMIC_FEE_FLAG
    pad(60),                                           // tickSpacing
    pad(HOOK_ADDRESS),
  ]))
}

// Slot0 layout (low → high): [160 bits sqrtPriceX96][24 tick][24 protocolFee][24 lpFee]
function decodeSlot0(data: string): { sqrtPriceX96: bigint; tick: number } {
  const raw = BigInt(data)
  const sqrtPriceX96 = raw & ((1n << 160n) - 1n)
  const tickRaw = Number((raw >> 160n) & 0xFFFFFFn)
  const tick = tickRaw >= 0x800000 ? tickRaw - 0x1000000 : tickRaw
  return { sqrtPriceX96, tick }
}

export interface PoolSlot0 {
  sqrtPriceX96: bigint
  tick: number
  source: 'chain' | 'simulation'
}

/**
 * Reads the live sqrtPriceX96 from the Uniswap v4 PoolManager via StateLibrary.extsload.
 * Returns null if the pool is uninitialised, the RPC is unreachable, or the value is
 * outside the plausible ETH price range ($50–$50k), so callers can fall back to simulation.
 */
export async function fetchOnChainSqrtPrice(): Promise<bigint | null> {
  try {
    const poolManager = new ethers.Contract(POOL_MANAGER, EXTSLOAD_ABI, provider())
    const poolId = computePoolId()
    const slot   = poolStateSlot(poolId)
    const data: string = await poolManager.extsload(slot)
    const { sqrtPriceX96 } = decodeSlot0(data)

    if (sqrtPriceX96 === 0n) return null          // pool not initialised

    // Sanity-check: reject if derived ETH price is outside $50–$50k
    // For token0=ETH(18), token1=USDC(6): ethPrice = sq^2/q96^2 * 1e12
    if (sqrtPriceX96 < SQ_MIN || sqrtPriceX96 > SQ_MAX) {
      console.log(`[on-chain] sqrtPriceX96 ${sqrtPriceX96} out of sane range — pool at init price, using simulation`)
      return null
    }

    return sqrtPriceX96
  } catch {
    return null
  }
}
