/**
 * Vercel serverless function — AI backend for the NetForge copilot.
 *
 * Works with ANY OpenAI-compatible chat API (Kira AI, Moonshot/Kimi, OpenAI,
 * OpenRouter, Groq, DeepSeek, …). The API key lives ONLY in server-side env
 * vars (in local dev the vite.config.ts bridge runs this in Node, so the key
 * never reaches the browser bundle).
 *
 * Request:  POST { messages: [{ role, content }], system?: string, mode?: 'plan' }
 * Response: 200 { reply: string, fallback: false }
 *      or   200 { fallback: true, reason }  → client uses local engine
 *      or   4xx/5xx { error }
 *
 * Env vars (first match wins):
 *   AI_API_KEY  | KIMI_API_KEY | MOONSHOT_API_KEY | VITE_AI_API_KEY | VITE_KIMI_API_KEY
 *   AI_BASE_URL | KIMI_BASE_URL   — full chat/completions URL
 *                                   default: https://kiraai.vn/api/v1/chat/completions
 *   AI_MODEL    | KIMI_MODEL      — default: "kira-3.5-flash"
 */

const CHAT_URL =
  process.env.AI_BASE_URL ||
  process.env.KIMI_BASE_URL ||
  'https://kiraai.vn/api/v1/chat/completions'
const DEFAULT_MODEL = process.env.AI_MODEL || process.env.KIMI_MODEL || 'kira-3.5-flash'

const FALLBACK_SYSTEM = [
  'You are NetForge Copilot, a friendly networking tutor embedded in a network simulator app.',
  'The user is a student working on hands-on labs (IP addressing, routing, switching, troubleshooting).',
  'Explain concepts clearly and concisely. Prefer short paragraphs and bullet lists.',
  'Use plain language for beginners, Cisco terminology where relevant.',
  'You can see a live snapshot of the student\'s simulated network in the conversation —',
  'ground your answers in that state when it is relevant. Never claim you changed the',
  'network yourself: configuration happens through the simulator UI, so tell the student',
  'what to change instead.',
].join('\n')

/**
 * System prompt for "plan" mode: the AI takeover asks the model to diagnose
 * the live network and propose machine-applicable fixes. The client validates
 * every change against a strict whitelist before anything is applied.
 */
const PLAN_SYSTEM = [
  'You are the diagnosis and repair engine of a network simulator teaching app.',
  'You receive a LIVE snapshot of a simulated network: devices, interfaces, IPs, subnet masks, default gateways, static routes, link status and link ids.',
  'Diagnose why connectivity tests fail and propose the minimal set of configuration changes that fixes the lab objective.',
  '',
  'Rules:',
  '- Change ONLY what is actually broken. Minimal, targeted fixes.',
  '- deviceRef MUST be an exact hostname from the snapshot.',
  '- linkId MUST be an exact id from the snapshot Links list.',
  '- Respond with ONLY a JSON object, no prose, no markdown fences:',
  '{"reasoning": "1-3 sentence diagnosis", "changes": [{"kind": "...", "deviceRef": "...", "summary": "...", "detail": "...", "payload": {}}]}',
  '',
  'Valid change kinds and their payload fields:',
  '- "gateway":          payload { "gateway": "a.b.c.d" }',
  '- "interface":        payload { "interfaceRef": "name", "ip": "a.b.c.d", "mask": "a.b.c.d" }  (or "prefix": 24 instead of "mask")',
  '- "interface-status": payload { "interfaceRef": "name", "status": "up" | "down" }',
  '- "route-add":        payload { "destination": "a.b.c.d", "mask": "a.b.c.d" | "prefix": 24, "nextHop": "a.b.c.d" }',
  '- "route-remove":     payload { "destination": "a.b.c.d", "mask": "a.b.c.d" | "prefix": 24 }',
  '- "link-status":      payload { "linkId": "from snapshot", "status": "up" | "down" }',
  '',
  'If the network is already healthy, return {"reasoning": "...", "changes": []}.',
].join('\n')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // VITE_KIMI_API_KEY is accepted as a local-dev convenience (the dev bridge in
  // vite.config.ts runs this handler in Node, so the key is never shipped to the
  // browser). For a real deployment use KIMI_API_KEY with no VITE_ prefix.
  const apiKey =
    process.env.AI_API_KEY ||
    process.env.KIMI_API_KEY ||
    process.env.MOONSHOT_API_KEY ||
    process.env.VITE_AI_API_KEY ||
    process.env.VITE_KIMI_API_KEY
  if (!apiKey) {
    // No key configured — tell the client to use its local rule-based engine.
    return res.status(200).json({ fallback: true, reason: 'not_configured' })
  }

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const history = Array.isArray(body?.messages) ? body.messages : null
  if (!history || history.length === 0) {
    return res.status(400).json({ error: 'messages[] is required' })
  }

  // Only role/content pairs are forwarded — nothing else from the client.
  const isPlanMode = body?.mode === 'plan'
  const messages = [
    { role: 'system', content: isPlanMode ? PLAN_SYSTEM : (body.system || FALLBACK_SYSTEM) },
    ...history
      .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
      .slice(-12) // keep the prompt small and cheap
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
  ]

  const callUpstream = () =>
    fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        temperature: isPlanMode ? 0 : 0.4,
        max_tokens: isPlanMode ? 1200 : 800,
      }),
    })

  try {
    // Router models (e.g. kira-auto) intermittently return 5xx / 429 under load.
    // Retry those up to twice with a short backoff before giving up to the
    // local engine. 4xx (auth, balance, permission) are never retried.
    let upstream = await callUpstream()
    for (let attempt = 1; attempt <= 2 && (upstream.status >= 500 || upstream.status === 429); attempt++) {
      await new Promise((r) => setTimeout(r, 600 * attempt))
      upstream = await callUpstream()
    }

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      console.error('AI upstream error', upstream.status, detail.slice(0, 500))
      return res.status(200).json({ fallback: true, reason: `upstream_${upstream.status}` })
    }

    const data = await upstream.json()
    const reply = data?.choices?.[0]?.message?.content
    if (typeof reply !== 'string' || !reply.trim()) {
      return res.status(200).json({ fallback: true, reason: 'empty_reply' })
    }

    return res.status(200).json({ reply: reply.trim(), fallback: false })
  } catch (error) {
    console.error('Assistant handler error', error)
    return res.status(200).json({ fallback: true, reason: 'network_error' })
  }
}
