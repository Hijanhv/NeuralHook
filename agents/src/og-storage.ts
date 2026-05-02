/**
 * Agent memory persistence — 0G Storage layer.
 *
 * Stores inference history and agent state as JSON files under OG_STORAGE_PATH.
 * The interface mirrors what @0glabs/0g-storage-client will expose once their
 * Node.js SDK ships — swapping the implementation only requires changing the
 * read/write calls below.
 *
 * Production path: replace fs.readFileSync / writeFileSync with
 *   await zgClient.uploadFile(path, data) / await zgClient.downloadFile(path)
 * using the 0G Storage node at OG_STORAGE_RPC_URL.
 */

import * as fs   from 'node:fs'
import * as path from 'node:path'
import type { InferenceResult, AuditEntry } from './types.js'

const STORAGE_DIR = process.env.OG_STORAGE_PATH ?? path.join(process.cwd(), 'data')

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true })
}

function storePath(key: string): string {
  return path.join(STORAGE_DIR, `${key}.json`)
}

function readJSON<T>(key: string, fallback: T): T {
  ensureDir()
  const p = storePath(key)
  if (!fs.existsSync(p)) return fallback
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) as T } catch { return fallback }
}

function writeJSON<T>(key: string, data: T): void {
  ensureDir()
  fs.writeFileSync(storePath(key), JSON.stringify(data, null, 2))
}

// ── Inference history ─────────────────────────────────────────────────────────

const MAX_HISTORY = 500

export function appendInferenceHistory(nodeId: string, result: InferenceResult): void {
  const key     = `inference_history_${nodeId}`
  const history = readJSON<InferenceResult[]>(key, [])
  history.push(result)
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY)
  writeJSON(key, history)
}

export function getInferenceHistory(nodeId: string, limit = 50): InferenceResult[] {
  const history = readJSON<InferenceResult[]>(`inference_history_${nodeId}`, [])
  return history.slice(-limit)
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export function appendAuditEntry(nodeId: string, entry: AuditEntry): void {
  const key  = `audit_log_${nodeId}`
  const log  = readJSON<AuditEntry[]>(key, [])
  log.push(entry)
  if (log.length > MAX_HISTORY) log.splice(0, log.length - MAX_HISTORY)
  writeJSON(key, log)
}

export function getPersistedAuditLog(nodeId: string): AuditEntry[] {
  return readJSON<AuditEntry[]>(`audit_log_${nodeId}`, [])
}

// ── Agent state snapshot ──────────────────────────────────────────────────────

interface AgentSnapshot {
  nodeId:         string
  lastConsensus:  number
  inferenceCount: number
  voteCount:      number
  savedAt:        number
}

export function saveAgentSnapshot(snapshot: AgentSnapshot): void {
  writeJSON(`agent_snapshot_${snapshot.nodeId}`, snapshot)
}

export function loadAgentSnapshot(nodeId: string): AgentSnapshot | null {
  return readJSON<AgentSnapshot | null>(`agent_snapshot_${nodeId}`, null)
}
