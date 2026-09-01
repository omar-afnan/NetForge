/**
 * Vercel serverless function — AI backend for the NetForge copilot.
 *
 * The Kimi (Moonshot) API key lives ONLY in server-side environment
 * variables (never VITE_*, which would be bundled into client JS and
 * readable by anyone in DevTools).
 *
 * Request:  POST { messages: [{ role, content }], system?: string }
 * Response: 200 { reply: string, fallback: false }
 *      or   200 { fallback: true, reason }  → client uses local engine
 *      or   4xx/5xx { error }
 *
 * Env vars:
 *   KIMI_API_KEY   (or MOONSHOT_API_KEY) — Moonshot API key
 *   KIMI_MODEL     — optional, default "moonshot-v1-8k"
 */

const MOONSHOT_URL = 'https://api.moonshot.cn/v1/chat/completions'
const DEFAULT_MODEL = 'moonshot-v1-8k'

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY
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
  const messages = [
    { role: 'system', content: body.system || FALLBACK_SYSTEM },
    ...history
      .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
      .slice(-12) // keep the prompt small and cheap
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
  ]

  try {
    const upstream = await fetch(MOONSHOT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.KIMI_MODEL || DEFAULT_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 800,
      }),
    })

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      console.error('Moonshot API error', upstream.status, detail.slice(0, 500))
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
