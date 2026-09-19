import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/celebrate', () => ({ celebrateLab: () => {} }))

import { ALL_LABS } from '@/data/labs'
import { useNetworkStore } from '@/store/networkStore'
import { setAuthTokenGetter } from '@/lib/authToken'
import { askLLM, requestLLMPlan } from './llm'

function stubFetch(impl: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(async (url: string, init: RequestInit) => impl(url, init))
  vi.stubGlobal('fetch', spy)
  return spy
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const sentBody = (spy: ReturnType<typeof stubFetch>) => JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string)

beforeEach(() => {
  useNetworkStore.getState().loadLab(ALL_LABS.find((l) => l.id === 'wrong-gateway')!)
})
afterEach(() => {
  vi.unstubAllGlobals()
  setAuthTokenGetter(null)
})

describe('client -> /api/assistant', () => {
  it('sends data only (context + messages): never a system prompt', async () => {
    const spy = stubFetch(() => json({ reply: 'hi', fallback: false }))
    await askLLM('why is PC-02 broken?')
    const body = sentBody(spy)
    expect(body).not.toHaveProperty('system')
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'why is PC-02 broken?' })
    expect(body.context).toContain('The Wrong Gateway')
    expect(body.messages.length).toBeLessThanOrEqual(12)
  })

  it('attaches the Clerk session token when signed in, and nothing when not', async () => {
    const spy = stubFetch(() => json({ reply: 'hi', fallback: false }))
    setAuthTokenGetter(async () => 'jwt-abc')
    await askLLM('x')
    expect((spy.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer jwt-abc')
    setAuthTokenGetter(null)
    await askLLM('x')
    expect((spy.mock.calls[1][1].headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('a failing token getter does not break the chat', async () => {
    stubFetch(() => json({ reply: 'ok', fallback: false }))
    setAuthTokenGetter(async () => {
      throw new Error('clerk down')
    })
    expect(await askLLM('x')).toBe('ok')
  })

  it.each([
    ['server says fallback', () => json({ fallback: true, reason: 'not_configured' })],
    ['HTTP 401', () => json({ error: 'Authentication required' }, 401)],
    ['HTTP 429', () => json({ error: 'Too many requests' }, 429)],
    ['HTTP 500', () => new Response('boom', { status: 500 })],
    ['non-JSON body', () => new Response('<html>', { status: 200 })],
    ['missing reply', () => json({})],
  ])('askLLM falls back (null) on %s', async (_n, impl) => {
    stubFetch(impl)
    expect(await askLLM('x')).toBeNull()
  })

  it('askLLM falls back on network failure and on timeout/abort', async () => {
    stubFetch(() => {
      throw new TypeError('offline')
    })
    expect(await askLLM('x')).toBeNull()
    stubFetch(() => {
      throw new DOMException('aborted', 'AbortError')
    })
    expect(await askLLM('x')).toBeNull()
  })
})

describe('requestLLMPlan (takeover planning)', () => {
  const reply = (obj: unknown) => json({ reply: typeof obj === 'string' ? obj : JSON.stringify(obj), fallback: false })

  it('requests plan mode with the live snapshot as a user message', async () => {
    const spy = stubFetch(() => reply({ reasoning: 'r', changes: [] }))
    await requestLLMPlan()
    const body = sentBody(spy)
    expect(body.mode).toBe('plan')
    expect(body).not.toHaveProperty('system')
    expect(body.messages[0].content).toMatch(/PC-02/)
    expect(body.messages[0].content).toMatch(/id:l1/)
  })

  it('returns a plan of AI-sourced, reference-checked changes', async () => {
    stubFetch(() =>
      reply({
        reasoning: 'PC-02 gateway is wrong',
        changes: [
          { kind: 'gateway', deviceRef: 'PC-02', summary: 'fix gw', payload: { gateway: '10.1.10.1' } },
          { kind: 'gateway', deviceRef: 'NOPE', summary: 'ghost', payload: { gateway: '10.1.10.1' } },
        ],
      }),
    )
    const plan = (await requestLLMPlan())!
    expect(plan.changes).toHaveLength(1)
    expect(plan.changes[0].source).toBe('ai')
    expect(plan.rejected).toHaveLength(1)
    expect(plan.rejected[0]).toMatch(/does not exist/)
  })

  it.each([
    ['prose', 'The lab is solved, nothing to do.'],
    ['no changes array', { reasoning: 'x' }],
    ['empty plan', { reasoning: 'x', changes: [] }],
    ['only invalid changes', { changes: [{ kind: 'reboot', deviceRef: 'R-01' }] }],
  ])('returns null (local planner takes over) for %s', async (_n, body) => {
    stubFetch(() => reply(body))
    expect(await requestLLMPlan()).toBeNull()
  })

  it('returns null on server fallback / errors', async () => {
    stubFetch(() => json({ fallback: true, reason: 'upstream_500' }))
    expect(await requestLLMPlan()).toBeNull()
    stubFetch(() => json({ error: 'nope' }, 401))
    expect(await requestLLMPlan()).toBeNull()
  })
})
