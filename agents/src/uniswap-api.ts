// Uniswap Trading API integration
// Agents call this to:
//   1. Get a reference ETH/USDC price (mainnet routing) as an additional IL signal
//   2. When risk is HIGH/CRITICAL, fetch + execute the optimal rebalance swap on-chain

import { ethers } from 'ethers'

const QUOTE_URL = 'https://trade-api.gateway.uniswap.org/v1/quote'
const SWAP_URL  = 'https://trade-api.gateway.uniswap.org/v1/swap'

// Reference price quote — Ethereum mainnet, 1 ETH
const WETH_MAINNET = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC_MAINNET = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const MAINNET_CHAIN_ID = 1
const ONE_ETH_WEI = '1000000000000000000'

// Swap execution — Base mainnet (cheap gas, Uniswap v3/v4 live)
const SWAP_CHAIN_ID  = parseInt(process.env.SWAP_CHAIN_ID  ?? '8453')
const SWAP_RPC_URL   = process.env.SWAP_RPC_URL   ?? 'https://mainnet.base.org'
const SWAP_AMOUNT_WEI = process.env.SWAP_AMOUNT_WEI ?? '100000000000000' // 0.0001 ETH

// USDC addresses by chain
const USDC: Record<number, string> = {
  1:    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
  10:   '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // Optimism
}

// WETH addresses by chain (used as tokenIn)
const WETH: Record<number, string> = {
  1:    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  8453: '0x4200000000000000000000000000000000000006',
  10:   '0x4200000000000000000000000000000000000006',
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RebalanceQuote {
  chainId: number
  tokenIn: string
  tokenOut: string
  amountIn: string
  amountOut: string
  priceETHUSD: number
  route: string
  priceImpactPct: number
  gasFeeUSD: string
  quoteId: string
  fetchedAt: number
}

export interface SwapExecution {
  txHash: string
  chainId: number
  amountInWei: string
  executedAt: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function apiHeaders(): Record<string, string> {
  const key = process.env.UNISWAP_API_KEY
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (key) h['x-api-key'] = key
  return h
}

function swapperAddress(): string {
  try {
    const pk = process.env.PRIVATE_KEY
    return pk ? new ethers.Wallet(pk).address : '0x0000000000000000000000000000000000000001'
  } catch {
    return '0x0000000000000000000000000000000000000001'
  }
}

// ── 1. Reference price quote (mainnet, 1 ETH) ────────────────────────────────

export async function getRebalanceQuote(
  ethAmountWei = ONE_ETH_WEI,
): Promise<RebalanceQuote | null> {
  try {
    const body = {
      type:              'EXACT_INPUT',
      tokenIn:           WETH_MAINNET,
      tokenOut:          USDC_MAINNET,
      tokenInChainId:    MAINNET_CHAIN_ID,
      tokenOutChainId:   MAINNET_CHAIN_ID,
      amount:            ethAmountWei,
      swapper:           swapperAddress(),
      slippageTolerance: '0.5',
    }

    const res = await fetch(QUOTE_URL, {
      method: 'POST', headers: apiHeaders(), body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      console.warn(`[uniswap-api] quote ${res.status}: ${(await res.text().catch(() => '')).slice(0, 120)}`)
      return null
    }

    const data = await res.json() as {
      quote?: {
        quoteId?: string
        output?: { amount?: string }
        gasUseEstimateUSD?: string
        priceImpact?: number
        routeString?: string
      }
    }

    const q = data.quote
    if (!q?.output?.amount) return null

    const amountOutUSDC = Number(q.output.amount) / 1e6
    const amountInETH   = Number(ethAmountWei) / 1e18
    const priceETHUSD   = amountOutUSDC / amountInETH

    console.log(`[uniswap-api] ref price: 1 ETH = $${priceETHUSD.toFixed(2)} · ${q.routeString ?? ''}`)

    return {
      chainId: MAINNET_CHAIN_ID,
      tokenIn: WETH_MAINNET, tokenOut: USDC_MAINNET,
      amountIn: ethAmountWei, amountOut: q.output.amount,
      priceETHUSD,
      route:          q.routeString    ?? 'Uniswap routing',
      priceImpactPct: q.priceImpact    ?? 0,
      gasFeeUSD:      q.gasUseEstimateUSD ?? '—',
      quoteId:        q.quoteId        ?? '',
      fetchedAt:      Date.now(),
    }
  } catch (e) {
    console.warn(`[uniswap-api] quote failed: ${(e as Error).message}`)
    return null
  }
}

// ── 2. Swap execution (Base, small amount) ────────────────────────────────────

async function fetchSwapQuote(): Promise<unknown | null> {
  const usdc = USDC[SWAP_CHAIN_ID]
  const weth = WETH[SWAP_CHAIN_ID]
  if (!usdc || !weth) {
    console.warn(`[uniswap-api] chain ${SWAP_CHAIN_ID} not configured`)
    return null
  }

  if (!process.env.UNISWAP_API_KEY) {
    console.warn('[uniswap-api] UNISWAP_API_KEY required for swap execution')
    return null
  }

  const body = {
    type:              'EXACT_INPUT',
    tokenIn:           weth,
    tokenOut:          usdc,
    tokenInChainId:    SWAP_CHAIN_ID,
    tokenOutChainId:   SWAP_CHAIN_ID,
    amount:            SWAP_AMOUNT_WEI,
    swapper:           swapperAddress(),
    slippageTolerance: '1.0',
  }

  const res = await fetch(QUOTE_URL, {
    method: 'POST', headers: apiHeaders(), body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    console.warn(`[uniswap-api] swap quote ${res.status}: ${(await res.text().catch(() => '')).slice(0, 120)}`)
    return null
  }

  return res.json()
}

async function fetchSwapCalldata(quoteResponse: unknown): Promise<{ to: string; data: string; value: string } | null> {
  const res = await fetch(SWAP_URL, {
    method:  'POST',
    headers: apiHeaders(),
    body:    JSON.stringify({ quote: quoteResponse }),
    signal:  AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    console.warn(`[uniswap-api] /v1/swap ${res.status}: ${(await res.text().catch(() => '')).slice(0, 120)}`)
    return null
  }

  const data = await res.json() as {
    swap?: { to?: string; data?: string; calldata?: string; value?: string }
  }
  const swap = data.swap
  if (!swap?.to) {
    console.warn('[uniswap-api] /v1/swap missing swap.to field')
    return null
  }

  return {
    to:    swap.to,
    data:  swap.data ?? swap.calldata ?? '0x',
    value: swap.value ?? '0x0',
  }
}

export async function executeRebalanceSwap(): Promise<SwapExecution | null> {
  const pk = process.env.PRIVATE_KEY
  if (!pk || !process.env.UNISWAP_API_KEY) return null

  try {
    const quoteResponse = await fetchSwapQuote()
    if (!quoteResponse) return null

    const calldata = await fetchSwapCalldata(quoteResponse)
    if (!calldata) return null

    const provider = new ethers.JsonRpcProvider(SWAP_RPC_URL)
    const wallet   = new ethers.Wallet(pk, provider)

    const tx = await wallet.sendTransaction({
      to:    calldata.to,
      data:  calldata.data,
      value: BigInt(calldata.value === '0x0' ? 0 : calldata.value),
    })

    console.log(`[uniswap-api] ✓ swap broadcast tx=${tx.hash} chain=${SWAP_CHAIN_ID} amount=${SWAP_AMOUNT_WEI}wei`)

    return {
      txHash:       tx.hash,
      chainId:      SWAP_CHAIN_ID,
      amountInWei:  SWAP_AMOUNT_WEI,
      executedAt:   Date.now(),
    }
  } catch (e) {
    console.warn(`[uniswap-api] swap execution failed: ${(e as Error).message}`)
    return null
  }
}
