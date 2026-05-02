/**
 * NeuralHook KeeperHub — MCP Server
 *
 * Exposes the keeper's execution capabilities as Model Context Protocol tools
 * so any MCP-compatible AI agent (Claude, etc.) can directly call them.
 *
 * Transports:
 *   MCP_TRANSPORT=stdio   → stdin/stdout (Claude Desktop, CLI)
 *   MCP_TRANSPORT=http    → HTTP POST /mcp  (remote agents, default)
 *
 * Tools exposed:
 *   get_pool_status          — run AI inference, return current IL risk
 *   submit_consensus_result  — submit a signed consensus result on-chain
 *   get_audit_log            — fetch execution audit trail
 *   trigger_volatility       — force a high-volatility inference round
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import express from 'express'
import { triggerRebalance, getAuditLog } from './keeperhub.js'
import { runInference } from './og-inference.js'
import { simulatePoolMetrics } from './il-calculator.js'
import { IL_RISK_INDEX, type ConsensusResult } from './types.js'

const MCP_PORT = parseInt(process.env.MCP_PORT ?? '5000')

// ── Server definition ─────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'neuralhook-keeper',
  version: '1.0.0',
})

// ── Tool: get_pool_status ─────────────────────────────────────────────────────

server.tool(
  'get_pool_status',
  'Run AI inference on the ETH/USDC pool and return the current IL risk assessment, recommended fee, and rebalance signal. Uses 0G Compute when configured, local heuristic otherwise.',
  {},
  async () => {
    const metrics = simulatePoolMetrics()
    const result  = await runInference(metrics)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          ilRisk:          result.ilRisk,
          recommendedFee:  result.recommendedFee,
          feePercent:      `${(result.recommendedFee / 100).toFixed(2)}%`,
          predictedILBps:  result.predictedILBps,
          rebalanceSignal: result.rebalanceSignal,
          yieldScore:      result.yieldScore,
          timestamp:       result.timestamp,
          resultHash:      result.resultHash,
          signature:       result.signature,
        }, null, 2),
      }],
    }
  },
)

// ── Tool: submit_consensus_result ─────────────────────────────────────────────

server.tool(
  'submit_consensus_result',
  'Submit a 2-of-3 consensus result on-chain through NeuralHook.sol. The signature must be from the trusted oracle address. Returns tx hash and gas used.',
  {
    ilRisk:          z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).describe('IL risk classification from consensus'),
    recommendedFee:  z.number().int().min(0).max(10000).describe('Fee override in basis points (500=0.05%, 10000=1%)'),
    predictedILBps:  z.number().int().min(0).describe('Predicted impermanent loss in basis points'),
    rebalanceSignal: z.boolean().describe('Whether LPs should consider rebalancing'),
    yieldScore:      z.number().int().min(0).max(255).describe('Yield quality score 0–255'),
    resultHash:      z.string().startsWith('0x').describe('keccak256 hash of the inference result'),
    signature:       z.string().startsWith('0x').describe('ECDSA signature from the trusted oracle'),
    timestamp:       z.number().int().positive().describe('Unix timestamp of the inference (must be < 10 min stale)'),
  },
  async (params) => {
    const consensus: ConsensusResult = {
      ilRisk:         params.ilRisk,
      ilRiskIndex:    IL_RISK_INDEX[params.ilRisk],
      recommendedFee: params.recommendedFee,
      predictedILBps: params.predictedILBps,
      rebalanceSignal: params.rebalanceSignal,
      yieldScore:     params.yieldScore,
      resultHash:     params.resultHash,
      signature:      params.signature,
      timestamp:      params.timestamp,
      signerAgentId:  'mcp-caller',
      agreementCount: 1,
    }
    const entry = await triggerRebalance(consensus)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          success: entry.success,
          txHash:  entry.txHash,
          gasUsed: entry.gasUsed,
          error:   entry.error ?? null,
        }, null, 2),
      }],
    }
  },
)

// ── Tool: run_and_submit ──────────────────────────────────────────────────────
// Convenience: does inference + submission in one call

server.tool(
  'run_and_submit',
  'Run AI inference on current pool state and immediately submit the result on-chain. One-shot tool that handles the full inference→consensus→submission flow.',
  {},
  async () => {
    const metrics   = simulatePoolMetrics()
    const result    = await runInference(metrics)
    const consensus: ConsensusResult = {
      ilRisk:         result.ilRisk,
      ilRiskIndex:    result.ilRiskIndex,
      recommendedFee: result.recommendedFee,
      predictedILBps: result.predictedILBps,
      rebalanceSignal: result.rebalanceSignal,
      yieldScore:     result.yieldScore,
      resultHash:     result.resultHash,
      signature:      result.signature,
      timestamp:      result.timestamp,
      signerAgentId:  'mcp-auto',
      agreementCount: 1,
    }
    const entry = await triggerRebalance(consensus)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          inferred: {
            ilRisk:         result.ilRisk,
            recommendedFee: result.recommendedFee,
            feePercent:     `${(result.recommendedFee / 100).toFixed(2)}%`,
          },
          submitted: {
            success: entry.success,
            txHash:  entry.txHash,
            gasUsed: entry.gasUsed,
            error:   entry.error ?? null,
          },
        }, null, 2),
      }],
    }
  },
)

// ── Tool: get_audit_log ───────────────────────────────────────────────────────

server.tool(
  'get_audit_log',
  'Fetch the KeeperHub audit trail — every on-chain submission attempt with tx hash, gas, fee, IL risk, success/failure.',
  {
    limit: z.number().int().min(1).max(100).default(10).describe('Number of most recent entries to return'),
  },
  async ({ limit }) => {
    const entries = getAuditLog().slice(-limit).reverse()
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(entries, null, 2),
      }],
    }
  },
)

// ── Tool: trigger_volatility ──────────────────────────────────────────────────

server.tool(
  'trigger_volatility',
  'Force an immediate high-volatility inference round. Simulates a market shock (adds +0.35 to volatility) and runs inference on the spiked metrics.',
  {},
  async () => {
    const base    = simulatePoolMetrics()
    const shocked = { ...base, volatility: Math.min(base.volatility + 0.35, 1) }
    const result  = await runInference(shocked)
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          triggered:       true,
          volatilityUsed:  shocked.volatility.toFixed(4),
          ilRisk:          result.ilRisk,
          recommendedFee:  result.recommendedFee,
          feePercent:      `${(result.recommendedFee / 100).toFixed(2)}%`,
          rebalanceSignal: result.rebalanceSignal,
        }, null, 2),
      }],
    }
  },
)

// ── Transport setup ───────────────────────────────────────────────────────────

async function startStdio() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[mcp] NeuralHook keeper running on stdio — connect via Claude Desktop or MCP CLI')
}

async function startHttp() {
  const app = express()
  app.use(express.json())

  // MCP Streamable HTTP transport (stateless per-request)
  app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on('close', () => transport.close())
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  })

  // Health / discovery endpoint
  app.get('/mcp', (_req, res) => {
    res.json({
      name:    'neuralhook-keeper',
      version: '1.0.0',
      tools: ['get_pool_status', 'submit_consensus_result', 'run_and_submit', 'get_audit_log', 'trigger_volatility'],
    })
  })

  app.listen(MCP_PORT, () => {
    console.log(`[mcp] NeuralHook KeeperHub MCP server on :${MCP_PORT}`)
    console.log(`[mcp] POST /mcp — tools: get_pool_status · submit_consensus_result · run_and_submit · get_audit_log · trigger_volatility`)
  })
}

// ── Entry point ───────────────────────────────────────────────────────────────

const transport = process.env.MCP_TRANSPORT ?? 'http'
if (transport === 'stdio') {
  startStdio().catch(e => { console.error(e); process.exit(1) })
} else {
  startHttp().catch(e => { console.error(e); process.exit(1) })
}
