import { ethers } from 'ethers'

const RPC_URL    = process.env.RPC_URL!
const PK         = process.env.PRIVATE_KEY!
const ORACLE_PK  = process.env.ORACLE_PRIVATE_KEY!
const HOOK_ADDR  = process.env.HOOK_ADDRESS!
const CHAIN_ID   = BigInt(process.env.CHAIN_ID ?? '1301')

const HOOK_ABI = [
  'function submitConsensusResult(bytes32 resultHash, uint8 ilRisk, uint256 predictedILBps, uint24 recommendedFee, bool rebalanceSignal, uint8 yieldScore, uint256 timestamp, bytes calldata signature) external',
  'function lastUpdateTimestamp() view returns (uint256)',
  'function trustedOracle() view returns (address)',
  'function paused() view returns (bool)',
  'function MAX_STALENESS() view returns (uint256)',
]

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet   = new ethers.Wallet(PK, provider)
  const oracle   = new ethers.Wallet(ORACLE_PK)
  const hook     = new ethers.Contract(HOOK_ADDR, HOOK_ABI, wallet)

  const block = await provider.getBlock('latest')
  console.log('chain block.timestamp:', block!.timestamp)
  console.log('local Date.now/1000:  ', Math.floor(Date.now()/1000))
  console.log('trustedOracle:        ', await hook.trustedOracle())
  console.log('oracle.address:       ', oracle.address)
  console.log('paused:               ', await hook.paused())
  console.log('MAX_STALENESS:        ', (await hook.MAX_STALENESS()).toString())
  console.log('lastUpdateTimestamp:  ', (await hook.lastUpdateTimestamp()).toString())

  const ilRiskIndex    = 1n          // MEDIUM
  const predictedILBps = 800n
  const recommendedFee = 3000
  const rebalanceSignal = false
  const yieldScore     = 60
  const ts             = BigInt(block!.timestamp) // use chain's own timestamp
  const resultHash     = ethers.keccak256(ethers.toUtf8Bytes(`MEDIUM:800:3000:${ts}`))

  const message = ethers.solidityPackedKeccak256(
    ['bytes32','uint8','uint256','uint24','bool','uint8','uint256','uint256','address'],
    [resultHash, ilRiskIndex, predictedILBps, recommendedFee,
     rebalanceSignal, yieldScore, ts, CHAIN_ID, HOOK_ADDR]
  )
  const sig = await oracle.signMessage(ethers.getBytes(message))

  console.log('\nattempting REAL tx submission...')
  try {
    const tx = await hook.submitConsensusResult(
      resultHash, ilRiskIndex, predictedILBps, recommendedFee,
      rebalanceSignal, yieldScore, ts, sig,
      { maxFeePerGas: 50_000_000_000n, maxPriorityFeePerGas: 10_000_000_000n }
    )
    console.log('tx hash:', tx.hash)
    console.log('waiting for confirmation...')
    const receipt = await tx.wait()
    console.log('receipt status:', receipt?.status)
    console.log('gasUsed:', receipt?.gasUsed.toString())
    console.log('logs:', receipt?.logs.length)
    console.log('lastUpdateTimestamp after:', (await hook.lastUpdateTimestamp()).toString())
  } catch (e: any) {
    console.log('SEND/WAIT FAILED:')
    console.log('  message:', e?.message?.slice(0, 300))
    console.log('  reason: ', e?.reason)
    console.log('  receipt status:', e?.receipt?.status)
    console.log('  receipt hash:', e?.receipt?.hash)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
