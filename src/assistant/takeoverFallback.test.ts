import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/celebrate', () => ({ celebrateLab: () => {} }))

// NOTE: ./llm is deliberately NOT mocked here - the real client talks to a stubbed /api/assistant.
import { ALL_LABS } from '@/data/labs'
import { useNetworkStore } from '@/store/networkStore'
import { useCopilotStore } from '@/store/copilotStore'
import { runLabAssist } from './labAssist'
import { askLLM, requestLLMPlan } from './llm'
import { verifyLab } from '@/features/labs/verification'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => {
  localStorage.clear()
  useNetworkStore.getState().resetAllLabs()
  useNetworkStore.getState().loadLab(ALL_LABS.find((l) => l.id === 'missing-route')!)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('misconfigured / unavailable upstream model', () => {
  it('a server fallback (upstream_404:model_not_found) yields no plan or reply and logs a safe reason', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => json({ fallback: true, reason: 'upstream_404:model_not_found' })))
    expect(await requestLLMPlan()).toBeNull()
    expect(await askLLM('hello')).toBeNull()
    const logged = warn.mock.calls.flat().join(' ')
    expect(logged).toContain('upstream_404:model_not_found')
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('[copilot]'))).toHaveLength(1) // once per distinct reason
  })

  it('the takeover still works via the local planner, and the SIMULATOR decides completion', async () => {
    const fetchSpy = vi.fn(async () => json({ fallback: true, reason: 'upstream_404:model_not_found' }))
    vi.stubGlobal('fetch', fetchSpy)
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.useFakeTimers()
    const done = runLabAssist('missing-route')
    await vi.runAllTimersAsync()
    await done

    expect(fetchSpy).toHaveBeenCalled() // the LLM was consulted first...
    expect(useCopilotStore.getState().labAssist.outcome).toBe('success') // ...then the local engine fixed it
    expect(verifyLab().solved).toBe(true)
    expect(useNetworkStore.getState().completedLabs['missing-route']?.completed).toBe(true)
  })

  it('an LLM that only CLAIMS success (empty plan) is ignored; the lab completes only because the simulator confirms the local fix', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ reply: JSON.stringify({ reasoning: 'All fixed, lab solved!', changes: [] }), fallback: false })),
    )
    // Before the run the claim is false: nothing is fixed and nothing is complete.
    expect(verifyLab().solved).toBe(false)
    vi.useFakeTimers()
    const done = runLabAssist('missing-route')
    await vi.runAllTimersAsync()
    await done
    const applied = useNetworkStore.getState().devices.find((d) => d.hostname === 'R-02')!.staticRoutes!
    expect(applied.some((r) => r.destination === '10.1.20.0')).toBe(true) // a real config change happened
    expect(verifyLab().solved).toBe(true)
    expect(useNetworkStore.getState().completedLabs['missing-route']?.completed).toBe(true)
  })

  it.each([
    ['401', () => json({ error: 'Authentication required' }, 401)],
    ['429', () => json({ error: 'Too many requests' }, 429)],
    ['network error', () => Promise.reject(new TypeError('offline'))],
  ])('HTTP/transport failure (%s) also falls back to the local planner', async (_n, impl) => {
    vi.stubGlobal('fetch', vi.fn(impl as () => Promise<Response>))
    vi.useFakeTimers()
    const done = runLabAssist('missing-route')
    await vi.runAllTimersAsync()
    await done
    expect(useNetworkStore.getState().completedLabs['missing-route']?.completed).toBe(true)
  })
})
