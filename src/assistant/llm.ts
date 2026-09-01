/**
 * Bridge from the copilot chat to the Kimi (Moonshot) LLM via the
 * `/api/assistant` serverless function.
 *
 * The API key never reaches the browser — the function holds it in a
 * server-side env var. If the function is unavailable, unconfigured, or
 * errors, askLLM() resolves to `null` and the caller falls back to the
 * local rule-based engine, so the copilot NEVER breaks — online or not.
 */
import { formatTopologyOverview, summarizeDevice, getSelectedDevice, formatLabInfo } from './context'
import { useCopilotStore } from '@/store/copilotStore'
import type { AssistantMessage } from './types'

export function buildSystemPrompt(): string {
  const lines = [
    'You are NetForge Copilot, a friendly networking tutor embedded in a network simulator app used by students.',
    'The student is currently inside a hands-on lab. LIVE snapshot of their simulated network follows.',
    'Ground your answers in this state when relevant. Be concise, encouraging, and practical.',
    'You cannot change the network yourself — if a configuration change is needed, tell the student exactly what to change (device, setting, value).',
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
 * unavailable (no key configured / error) — callers must have a local
 * fallback ready.
 */
export async function askLLM(userText: string): Promise<string | null> {
  try {
    const history = toChatHistory(useCopilotStore.getState().messages)
    history.push({ role: 'user', content: userText })

    const response = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: buildSystemPrompt(), messages: history }),
    })
    if (!response.ok) return null

    const data: { reply?: string; fallback?: boolean } = await response.json()
    if (data.fallback || typeof data.reply !== 'string' || !data.reply) return null
    return data.reply
  } catch {
    return null
  }
}

/**
 * True when the serverless function reports a configured key. Used once at
 * startup to show an "AI online" hint in the copilot UI (best-effort).
 */
export async function llmConfigured(): Promise<boolean> {
  try {
    const response = await fetch('/api/assistant', {
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
