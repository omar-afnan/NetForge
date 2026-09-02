/**
 * Bridge from the copilot chat to the Kimi (Moonshot) LLM via the
 * `/api/assistant` serverless function.
 *
 * The API key never reaches the browser - the function holds it in a
 * server-side env var. If the function is unavailable, unconfigured, or
 * errors, askLLM() resolves to `null` and the caller falls back to the
 * local rule-based engine, so the copilot NEVER breaks - online or not.
 */
import { formatTopologyOverview, summarizeDevice, getSelectedDevice, formatLabInfo } from './context'
import { useCopilotStore } from '@/store/copilotStore'
import { useNetworkStore } from '@/store/networkStore'
import type { AssistantMessage } from './types'
import type { ProposedChange } from './types'

/**
 * Serverless function calls can hang on cold starts or if the backend
 * misbehaves - an unbounded `fetch` would leave the copilot stuck on
 * "Thinking…" forever (input disabled, no escape). Bound every round-trip so a
 * slow/unresponsive backend falls back to the local rule-based engine instead.
 */
const LLM_TIMEOUT_MS = 20000

function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = LLM_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    window.clearTimeout(timer)
  })
}

export function buildSystemPrompt(): string {
  const lines = [
    'You are NetForge Copilot, a friendly networking tutor embedded in a network simulator app used by students.',
    'The student is currently inside a hands-on lab. LIVE snapshot of their simulated network follows.',
    'Ground your answers in this state when relevant. Be concise, encouraging, and practical.',
    'You cannot change the network yourself - if a configuration change is needed, tell the student exactly what to change (device, setting, value).',
    'Prefer short paragraphs and bullet lists. Use Cisco terminology where it aids learning.',
    '',
    '--- LIVE NETWORK SNAPSHOT ---',
    formatTopologyOverview(),
    '',
    formatLabInfo(),
    '',
    'Selected device:',
    getSelectedDevice() ? summarizeDevice(getSelectedDevice()!) : '(none)',
    '--- END SNAPSHOT ---',
  ]
  return lines.join('\n')
}

function toChatHistory(messages: AssistantMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  return messages
    .filter((m) => m.kind === 'text')
    .map((m) => ({ role: m.role, content: m.text }))
}

/**
 * Ask the LLM. Resolves to a reply string, or `null` when the backend is
 * unavailable (no key configured / error) - callers must have a local
 * fallback ready.
 */
export async function askLLM(userText: string): Promise<string | null> {
  try {
    const history = toChatHistory(useCopilotStore.getState().messages)
    history.push({ role: 'user', content: userText })

    const response = await fetchWithTimeout('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: buildSystemPrompt(), messages: history }),
    })
    if (!response.ok) return null

    const data: { reply?: string; fallback?: boolean } = await response.json()
    if (data.fallback || typeof data.reply !== 'string' || !data.reply) return null
    return data.reply
  } catch {
    // Includes AbortError on timeout → fall back to the local engine so the
    // chat never freezes waiting on a slow or unresponsive backend.
    return null
  }
}

/**
 * True when the serverless function reports a configured key. Used once at
 * startup to show an "AI online" hint in the copilot UI (best-effort).
 */
export async function llmConfigured(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }] }),
    })
    if (!response.ok) return false
    const data: { fallback?: boolean } = await response.json()
    return data.fallback !== true
  } catch {
    return false
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * AI TAKEOVER - LLM-driven lab planning
 * ────────────────────────────────────────────────────────────────────── */

export interface LLMPlan {
  reasoning: string
  changes: ProposedChange[]
}

const PLAN_KINDS = new Set(['gateway', 'interface', 'interface-status', 'route-add', 'route-remove', 'link-status'])

/** Full network snapshot for the planning prompt - includes link ids so the LLM can restore downed links. */
export function buildNetworkSnapshot(): string {
  const { devices, links, lab, issues } = useNetworkStore.getState()
  const lines: string[] = [
    `Lab objective: "${lab.title}" (${lab.difficulty}) - ${lab.description}`,
    '',
    'Devices and their configuration:',
  ]
  for (const device of devices) {
    lines.push(summarizeDevice(device))
    lines.push('')
  }
  lines.push('Links (id: source ↔ target [status]):')
  for (const link of links) {
    const source = devices.find((d) => d.id === link.sourceDeviceId)
    const target = devices.find((d) => d.id === link.targetDeviceId)
    lines.push(`- id:${link.id} - ${source?.hostname ?? '?'} ↔ ${target?.hostname ?? '?'} [${link.status}]`)
  }
  if (issues.length > 0) {
    lines.push('', `Open issues detected: ${issues.length}.`)
  }
  return lines.join('\n')
}

/** Pull the first JSON object out of an LLM reply (handles markdown fences / prose). */
function extractJson(raw: string): Record<string, unknown> | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw)
  const text = fenced ? fenced[1] : raw
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isIp = (v: unknown): v is string => isStr(v) && /^\d{1,3}(\.\d{1,3}){3}$/.test(v)

/**
 * Validate LLM-proposed changes against the simulator's supported change
 * schema. Anything malformed, hallucinated, or unsupported is dropped -
 * only changes that `executeChange` can safely run survive.
 */
function sanitizeChanges(raw: unknown): ProposedChange[] {
  if (!Array.isArray(raw)) return []
  const out: ProposedChange[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const c = item as Record<string, unknown>
    const kind = c.kind
    if (typeof kind !== 'string' || !PLAN_KINDS.has(kind)) continue
    const payloadRaw = (typeof c.payload === 'object' && c.payload !== null ? c.payload : {}) as Record<string, unknown>
    const payload: Record<string, unknown> = {}
    let valid = true

    switch (kind) {
      case 'gateway':
        if (!isIp(payloadRaw.gateway)) valid = false
        else payload.gateway = payloadRaw.gateway
        break
      case 'interface': {
        if (!isStr(payloadRaw.interfaceRef) || !isIp(payloadRaw.ip)) { valid = false; break }
        payload.interfaceRef = payloadRaw.interfaceRef
        payload.ip = payloadRaw.ip
        if (isIp(payloadRaw.mask)) payload.mask = payloadRaw.mask
        else if (typeof payloadRaw.prefix === 'number' && payloadRaw.prefix >= 0 && payloadRaw.prefix <= 32) payload.prefix = payloadRaw.prefix
        else valid = false
        break
      }
      case 'interface-status':
        if (!isStr(payloadRaw.interfaceRef) || (payloadRaw.status !== 'up' && payloadRaw.status !== 'down')) valid = false
        else {
          payload.interfaceRef = payloadRaw.interfaceRef
          payload.status = payloadRaw.status
        }
        break
      case 'route-add':
      case 'route-remove': {
        if (!isIp(payloadRaw.destination)) { valid = false; break }
        payload.destination = payloadRaw.destination
        if (isIp(payloadRaw.mask)) payload.mask = payloadRaw.mask
        else if (typeof payloadRaw.prefix === 'number' && payloadRaw.prefix >= 0 && payloadRaw.prefix <= 32) payload.prefix = payloadRaw.prefix
        if (kind === 'route-add') {
          if (!isIp(payloadRaw.nextHop)) { valid = false; break }
          payload.nextHop = payloadRaw.nextHop
        }
        break
      }
      case 'link-status':
        if (!isStr(payloadRaw.linkId) || (payloadRaw.status !== 'up' && payloadRaw.status !== 'down')) valid = false
        else {
          payload.linkId = payloadRaw.linkId
          payload.status = payloadRaw.status
        }
        break
    }

    if (!valid) continue
    const deviceRef = isStr(c.deviceRef) ? c.deviceRef : undefined
    if (kind !== 'link-status' && !deviceRef) continue
    out.push({
      id: crypto.randomUUID(),
      kind: kind as ProposedChange['kind'],
      deviceRef,
      summary: isStr(c.summary) ? c.summary.slice(0, 200) : `${kind} change`,
      detail: isStr(c.detail) ? c.detail.slice(0, 300) : undefined,
      payload,
    })
  }
  return out
}

/**
 * Ask the LLM to diagnose the live network and propose a fix plan.
 * Resolves `null` whenever the LLM is unavailable or returns nothing
 * usable - callers must fall back to the local `scanLab()` planner.
 */
export async function requestLLMPlan(): Promise<LLMPlan | null> {
  try {
    const response = await fetchWithTimeout('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'plan',
        messages: [{ role: 'user', content: buildNetworkSnapshot() }],
      }),
    })
    if (!response.ok) return null
    const data: { reply?: string; fallback?: boolean } = await response.json()
    if (data.fallback || typeof data.reply !== 'string') return null

    const parsed = extractJson(data.reply)
    if (!parsed) return null
    const changes = sanitizeChanges(parsed.changes)
    if (changes.length === 0) return null
    return {
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 500) : '',
      changes,
    }
  } catch {
    return null
  }
}
