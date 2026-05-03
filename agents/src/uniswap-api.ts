// Uniswap Trading API integration
// Agents call this to:
//   1. Get a reference ETH/USDC price (Ethereum mainnet routing) as an additional IL signal
//   2. When risk reaches CRITICAL, compute the optimal rebalance swap quote

const TRADING_API_URL = 'https://trade-api.gateway.uniswap.org/v1/quote'

const WETH_MAINNET = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const USDC_MAINNET = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const MAINNET_CHAIN_ID = 1

const ONE_ETH_WEI = '1000000000000000000'

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

interface TradingAPIResponse {
  routing?: string
  quote?: {
    quoteId?: string
    output?: { amount?: string }
    input?: { amount?: string }
    gasUseEstimateUSD?: string
    priceImpact?: number
    routeString?: string
  }
  errorCode?: string
  detail?: string
}

export async function getRebalanceQuote(
  ethAmountWei = ONE_ETH_WEI,
): Promise<RebalanceQuote | null> {
  try {
    const apiKey = process.env.UNISWAP_API_KEY
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['x-api-key'] = apiKey

    const body = {
      type:            'EXACT_INPUT',
      tokenIn:         WETH_MAINNET,
      tokenOut:        USDC_MAINNET,
      tokenInChainId:  MAINNET_CHAIN_ID,
      tokenOutChainId: MAINNET_CHAIN_ID,
      amount:          ethAmountWei,
      swapper:         process.env.ORACLE_ADDRESS ?? '0x0000000000000000000000000000000000000001',
      slippageTolerance: '0.5',
    }

    const res = await fetch(TRADING_API_URL, {
      method:  'POST',
      headers,
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn(`[uniswap-api] Trading API ${res.status}: ${errText.slice(0, 120)}`)
      return null
    }

    const data = await res.json() as TradingAPIResponse
    const q = data.quote
    if (!q?.output?.amount) {
      console.warn('[uniswap-api] unexpected response shape:', JSON.stringify(data).slice(0, 200))
      return null
    }

    const amountOutUSDC = Number(q.output.amount) / 1e6
    const amountInETH   = Number(ethAmountWei) / 1e18
    const priceETHUSD   = amountOutUSDC / amountInETH

    console.log(`[uniswap-api] quote: 1 ETH → $${priceETHUSD.toFixed(2)} USDC · route: ${q.routeString ?? 'unknown'}`)

    return {
      chainId:        MAINNET_CHAIN_ID,
      tokenIn:        WETH_MAINNET,
      tokenOut:       USDC_MAINNET,
      amountIn:       ethAmountWei,
      amountOut:      q.output.amount,
      priceETHUSD,
      route:          q.routeString ?? 'Uniswap routing',
      priceImpactPct: q.priceImpact ?? 0,
      gasFeeUSD:      q.gasUseEstimateUSD ?? '—',
      quoteId:        q.quoteId ?? '',
      fetchedAt:      Date.now(),
    }
  } catch (e) {
    console.warn(`[uniswap-api] quote fetch failed: ${(e as Error).message}`)
    return null
  }
}
