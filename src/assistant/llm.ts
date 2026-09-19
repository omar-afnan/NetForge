/**
 * Bridge from the copilot chat to an OpenAI-compatible LLM via the
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
import { getAuthToken } from '@/lib/authToken'
import { parseLLMPlan } from './changeValidation'
import type { AssistantMessage } from './types'
import type { ProposedChange } from './types'

/**
 * Serverless function calls can hang on cold starts or if the backend
 * misbehaves - an unbounded `fetch` would leave the copilot stuck on
 * "Thinking…" forever (input disabled, no escape). Bound every round-trip so a
 * slow/unresponsive backend falls back to the local rule-based engine instead.
 */
const LLM_TIMEOUT_MS = 25000

function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = LLM_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    window.clearTimeout(timer)
  })
}

/**
 * POST JSON to the assistant endpoint with the caller's Clerk session token
 * (when there is one). Only data goes up: the system prompt is owned by the
 * server, so the client cannot steer the model's instructions.
 */
async function postAssistant(payload: unknown): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = await getAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return fetchWithTimeout('/api/assistant', { method: 'POST', headers, body: JSON.stringify(payload) })
}

/** Live-network data blob sent as `context`; the server wraps it as untrusted data. */
export function buildContextSnapshot(): string {
  const selected = getSelectedDevice()
  return [
    formatTopologyOverview(),
    '',
    formatLabInfo(),
    '',
    'Selected device:',
    selected ? summarizeDevice(selected) : '(none)',
  ].join('\n')
}

let lastFallbackReason: string | undefined

/** Log (once per distinct reason) why the AI backend was skipped, e.g. "upstream_404:model_not_found". */
function noteFallback(reason: string | undefined) {
  if (!reason || reason === lastFallbackReason) return
  lastFallbackReason = reason
  console.warn(`[copilot] AI backend unavailable (${reason}); using the local engine.`)
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

    const response = await postAssistant({
      context: buildContextSnapshot(),
      messages: history.slice(-12),
    })
    if (!response.ok) return null

    const data: { reply?: string; fallback?: boolean; reason?: string } = await response.json()
    if (data.fallback) noteFallback(data.reason)
    if (data.fallback || typeof data.reply !== 'string' || !data.reply) return null
    return data.reply
  } catch {
    // Includes AbortError on timeout → fall back to the local engine so the
    // chat never freezes waiting on a slow or unresponsive backend.
    return null
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * AI TAKEOVER - LLM-driven lab planning
 * ────────────────────────────────────────────────────────────────────── */

export interface LLMPlan {
  reasoning: string
  changes: ProposedChange[]
}

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

export interface LLMPlanResult extends LLMPlan {
  /** Why individual proposed changes were dropped (shown to the student). */
  rejected: string[]
}

/**
 * Ask the LLM to diagnose the live network and propose a fix plan.
 * Resolves `null` whenever the LLM is unavailable or returns nothing
 * usable - callers must fall back to the local `scanLab()` planner.
 *
 * The reply is only ever *proposals*: it is schema-checked and every named
 * device / interface / link is verified against the live topology here, and
 * values are re-validated at apply time (executeChange). It never decides
 * whether a lab is solved.
 */
export async function requestLLMPlan(): Promise<LLMPlanResult | null> {
  try {
    const response = await postAssistant({
      mode: 'plan',
      messages: [{ role: 'user', content: buildNetworkSnapshot() }],
    })
    if (!response.ok) return null
    const data: { reply?: string; fallback?: boolean; reason?: string } = await response.json()
    if (data.fallback) noteFallback(data.reason)
    if (data.fallback || typeof data.reply !== 'string') return null

    const { devices, links } = useNetworkStore.getState()
    const plan = parseLLMPlan(data.reply, { devices, links })
    if (!plan || plan.changes.length === 0) return null
    return plan
  } catch {
    return null
  }
}
