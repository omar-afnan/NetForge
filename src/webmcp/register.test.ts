import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/celebrate', () => ({ celebrateLab: () => {} }))
vi.mock('@/assistant/llm', () => ({ requestLLMPlan: vi.fn(async () => null), askLLM: vi.fn(async () => null) }))

const polyfill = vi.hoisted(() => ({ init: vi.fn() }))
vi.mock('@mcp-b/webmcp-polyfill', () => ({ initializeWebMCPPolyfill: polyfill.init }))

import { ALL_LABS } from '@/data/labs'
import { useNetworkStore } from '@/store/networkStore'
import { useCopilotStore } from '@/store/copilotStore'
import { useUIStore } from '@/store/uiStore'
import { VIEWS, buildTools, registerNetForgeWebMCP, resetWebMCPRegistrationForTests } from './register'

/** Minimal stand-in for document.modelContext; rejects duplicate names like the real one. */
function makeModelContext(opts: { failOn?: string } = {}) {
  const tools = new Map<string, { name: string; description: string; inputSchema: Record<string, any>; execute: (a: unknown) => any }>()
  return {
    tools,
    registerTool: vi.fn(async (d: any) => {
      if (opts.failOn === d.name) throw new Error('rejected by browser')
      if (tools.has(d.name)) throw new Error(`Tool already registered: ${d.name}`)
      tools.set(d.name, d)
    }),
    getTools: vi.fn(async () => [...tools.values()].map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))),
  }
}
type Ctx = ReturnType<typeof makeModelContext>

function installNative(ctx: Ctx) {
  Object.defineProperty(document, 'modelContext', { value: ctx, configurable: true, writable: true })
}
function uninstall() {
  delete (document as unknown as Record<string, unknown>).modelContext
}

const EXPECTED = [
  'netforge_list_labs',
  'netforge_get_state',
  'netforge_get_topology',
  'netforge_run_connectivity_tests',
  'netforge_ping',
  'netforge_diagnose',
  'netforge_load_lab',
  'netforge_apply_suggested_fix',
  'netforge_take_over_lab',
  'netforge_set_view',
]

async function setup(opts: { failOn?: string } = {}) {
  const ctx = makeModelContext(opts)
  installNative(ctx)
  await registerNetForgeWebMCP()
  const call = (name: string, args: unknown = {}) => {
    const res = ctx.tools.get(name)!.execute(args)
    const text = res.content[0].text as string
    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
    return { res, data, isError: !!res.isError }
  }
  return { ctx, call }
}

beforeEach(() => {
  resetWebMCPRegistrationForTests()
  polyfill.init.mockReset()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  localStorage.clear()
  useNetworkStore.getState().resetAllLabs()
  useNetworkStore.getState().loadLab(ALL_LABS.find((l) => l.id === 'wrong-gateway')!)
})
afterEach(() => {
  uninstall()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('registration', () => {
  it('registers exactly the 10 documented tools with well-formed schemas', async () => {
    const { ctx } = await setup()
    expect([...ctx.tools.keys()].sort()).toEqual([...EXPECTED].sort())
    for (const tool of ctx.tools.values()) {
      expect(tool.description.length).toBeGreaterThan(20)
      expect(tool.inputSchema.type).toBe('object')
      expect(tool.inputSchema.additionalProperties).toBe(false)
      for (const req of tool.inputSchema.required ?? []) expect(tool.inputSchema.properties).toHaveProperty(req)
    }
    expect(ctx.tools.get('netforge_ping')!.inputSchema.required).toEqual(['from', 'to'])
    expect(ctx.tools.get('netforge_set_view')!.inputSchema.properties.view.enum).toEqual([...VIEWS])
  })

  it('tool definitions are unique and match the documented list', () => {
    const names = buildTools().map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names.sort()).toEqual([...EXPECTED].sort())
  })

  it('uses the native document.modelContext when present (no polyfill)', async () => {
    await setup()
    expect(polyfill.init).not.toHaveBeenCalled()
  })

  it('installs the polyfill when there is no native API, then registers on it', async () => {
    const ctx = makeModelContext()
    polyfill.init.mockImplementation(() => installNative(ctx))
    await registerNetForgeWebMCP()
    expect(polyfill.init).toHaveBeenCalledTimes(1)
    expect(ctx.tools.size).toBe(10)
  })

  it('rejects (and can retry) when the polyfill fails to install', async () => {
    polyfill.init.mockImplementation(() => {
      throw new Error('boom')
    })
    await expect(registerNetForgeWebMCP()).rejects.toThrow('boom')
    const ctx = makeModelContext()
    polyfill.init.mockImplementation(() => installNative(ctx))
    await registerNetForgeWebMCP()
    expect(ctx.tools.size).toBe(10)
  })

  it('rejects when the polyfill installs nothing', async () => {
    polyfill.init.mockImplementation(() => {})
    await expect(registerNetForgeWebMCP()).rejects.toThrow(/modelContext/)
  })

  it('is idempotent: repeated and concurrent calls register each tool once', async () => {
    const ctx = makeModelContext()
    installNative(ctx)
    await Promise.all([registerNetForgeWebMCP(), registerNetForgeWebMCP(), registerNetForgeWebMCP()])
    await registerNetForgeWebMCP()
    expect(ctx.registerTool).toHaveBeenCalledTimes(10)
  })

  it('tolerates tools that are already registered (HMR / another script)', async () => {
    const ctx = makeModelContext()
    installNative(ctx)
    await ctx.registerTool({ name: 'netforge_ping', description: 'pre-existing', inputSchema: { type: 'object' }, execute: () => ({}) })
    await expect(registerNetForgeWebMCP()).resolves.toBeUndefined()
    expect(ctx.tools.size).toBe(10)
    expect(ctx.tools.get('netforge_ping')!.description).toBe('pre-existing')
  })

  it('a duplicate-name rejection from the browser does not stop the other tools', async () => {
    const ctx = makeModelContext({ failOn: 'netforge_diagnose' })
    ctx.getTools.mockResolvedValue([]) // pretend we cannot see existing tools
    installNative(ctx)
    await registerNetForgeWebMCP()
    expect(ctx.tools.size).toBe(9)
    expect(ctx.tools.has('netforge_set_view')).toBe(true)
  })

  it('works when getTools is not implemented', async () => {
    const ctx = makeModelContext()
    delete (ctx as { getTools?: unknown }).getTools
    installNative(ctx)
    await registerNetForgeWebMCP()
    expect(ctx.tools.size).toBe(10)
  })
})

describe('argument validation (untrusted agent input)', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an array', ['PC-01', 'SRV-01']],
    ['a string', 'PC-01'],
    ['a number', 42],
    ['empty object', {}],
    ['missing to', { from: 'PC-01' }],
    ['numeric from', { from: 1, to: 'SRV-01' }],
    ['object to', { from: 'PC-01', to: { $ne: 1 } }],
    ['blank strings', { from: '  ', to: '' }],
    ['over-long name', { from: 'A'.repeat(500), to: 'SRV-01' }],
  ])('netforge_ping rejects %s with a structured error', async (_n, args) => {
    const { call } = await setup()
    const r = call('netforge_ping', args)
    expect(r.isError).toBe(true)
    expect(r.data.ok).toBe(false)
    expect(typeof r.data.error).toBe('string')
  })

  it('netforge_ping ignores extra properties and works for valid input', async () => {
    const { call } = await setup()
    const r = call('netforge_ping', { from: 'PC-01', to: 'SRV-01', __proto__: { x: 1 }, extra: 'ignored' })
    expect(r.isError).toBe(false)
    expect(r.data.reachable).toBe(true)
    expect(r.data.hops).toEqual(['PC-01', 'R-01', 'R-02', 'R-03', 'SRV-01'])
  })

  it('netforge_ping reports unknown / malformed device ids as unreachable (not a crash)', async () => {
    const { call } = await setup()
    for (const bad of [{ from: 'GHOST', to: 'SRV-01' }, { from: 'PC-01', to: 'nope.example' }, { from: 'PC-01', to: '999.1.1.1' }, { from: 'PC-01', to: '1..2.3' }]) {
      const r = call('netforge_ping', bad)
      expect(r.data.reachable).toBe(false)
      expect(r.data.error).toBeTruthy()
    }
  })

  it('netforge_ping reflects a real failure with the simulator reason', async () => {
    const { call } = await setup()
    const r = call('netforge_ping', { from: 'PC-02', to: 'SRV-01' })
    expect(r.data.reachable).toBe(false)
    expect(r.data.detail).toBe('ARP resolution failed for gateway')
  })

  it.each([undefined, null, {}, { labId: 7 }, { labId: '' }, { labId: '   ' }, { labId: ['wrong-gateway'] }, { labId: 'x'.repeat(200) }])(
    'netforge_load_lab rejects malformed args %j',
    async (args) => {
      const { call } = await setup()
      expect(call('netforge_load_lab', args).isError).toBe(true)
      expect(useNetworkStore.getState().lab.id).toBe('wrong-gateway')
    },
  )

  it.each(['nope', '__proto__', 'constructor', '../etc/passwd', 'WRONG-GATEWAY'])('netforge_load_lab rejects invalid lab id %j', async (labId) => {
    const { call } = await setup()
    const r = call('netforge_load_lab', { labId })
    expect(r.isError).toBe(true)
    expect(r.data.error).toMatch(/netforge_list_labs/)
    expect(useNetworkStore.getState().lab.id).toBe('wrong-gateway')
  })

  it('netforge_set_view validates against the allowed views', async () => {
    const { call } = await setup()
    for (const bad of [undefined, {}, { view: 3 }, { view: 'admin' }, { view: 'agents' }, { view: '__proto__' }, { view: 'learn; drop' }]) {
      const r = call('netforge_set_view', bad)
      expect(r.isError, JSON.stringify(bad)).toBe(true)
    }
    for (const view of VIEWS) {
      expect(call('netforge_set_view', { view }).isError).toBe(false)
      expect(useUIStore.getState().activeView).toBe(view)
    }
  })

  it('no-arg tools tolerate junk arguments', async () => {
    const { call } = await setup()
    for (const name of ['netforge_list_labs', 'netforge_get_state', 'netforge_get_topology', 'netforge_run_connectivity_tests', 'netforge_diagnose']) {
      expect(call(name, null).isError, name).toBe(false)
      expect(call(name, 'junk').isError, name).toBe(false)
      expect(call(name, { unexpected: 1 }).isError, name).toBe(false)
    }
  })
})

describe('read-only tools', () => {
  it('list_labs returns every lab with faults counted', async () => {
    const { call } = await setup()
    const labs = call('netforge_list_labs').data
    expect(labs.map((l: any) => l.id)).toEqual(ALL_LABS.map((l) => l.id))
    expect(labs.find((l: any) => l.id === 'final-boss').injectedFaults).toBe(4)
  })

  it('get_state / get_topology / run_connectivity_tests / diagnose reflect the live lab', async () => {
    const { call } = await setup()
    const state = call('netforge_get_state').data
    expect(state).toMatchObject({ id: 'wrong-gateway', completed: false, solvedNow: false, takeover: { running: false } })
    expect(call('netforge_get_topology').data).toContain('The Wrong Gateway')
    expect(call('netforge_run_connectivity_tests').data).toMatch(/^38\/42 paths passing/)
    const diag = call('netforge_diagnose').data
    expect(diag.proposedFixes).toContain('Fix PC-02 default gateway → 10.1.10.1')
    // diagnose is read-only
    expect(useNetworkStore.getState().devices.find((d) => d.hostname === 'PC-02')!.defaultGateway).toBe('10.1.10.254')
  })
})

describe('tools across lab switches and resets', () => {
  it('after switching labs, every tool acts on the newly loaded lab', async () => {
    const { call } = await setup()
    const loaded = call('netforge_load_lab', { labId: 'missing-route' }).data
    expect(loaded.ok).toBe(true)
    expect(loaded.loaded.id).toBe('missing-route')
    expect(useUIStore.getState().activeView).toBe('topology')
    expect(call('netforge_get_state').data.id).toBe('missing-route')
    expect(call('netforge_ping', { from: 'PC-02', to: 'SRV-01' }).data.detail).toBe('No route to destination')
    expect(call('netforge_diagnose').data.proposedFixes[0]).toMatch(/R-02/)
    const fix = call('netforge_apply_suggested_fix').data
    expect(fix.ok).toBe(true)
    expect(fix.applied).toMatch(/R-02/)
    expect(fix.labCompleted).toBe(true)
    // the previous lab was never touched
    expect(useNetworkStore.getState().completedLabs['wrong-gateway']).toBeUndefined()
    expect(useNetworkStore.getState().completedLabs['missing-route']?.completed).toBe(true)
  })

  it('after a reset, the lab is broken again, not completed, and fixable again', async () => {
    const { call } = await setup()
    for (let i = 0; i < 3 && !call('netforge_get_state').data.completed; i++) call('netforge_apply_suggested_fix')
    expect(call('netforge_get_state').data.completed).toBe(true)

    useNetworkStore.getState().resetLab()
    expect(call('netforge_get_state').data).toMatchObject({ completed: false, solvedNow: false })
    expect(call('netforge_ping', { from: 'PC-02', to: 'SRV-01' }).data.reachable).toBe(false)
    expect(call('netforge_apply_suggested_fix').data.labCompleted).toBe(true)
    expect(call('netforge_get_state').data.completed).toBe(true)
  })

  it('reset with nothing broken: apply_suggested_fix is a harmless no-op and never fabricates a completion', async () => {
    const { call } = await setup()
    call('netforge_load_lab', { labId: 'starter' })
    const r = call('netforge_apply_suggested_fix').data
    expect(r.ok).toBe(false)
    expect(useNetworkStore.getState().completedLabs.starter).toBeUndefined()
  })

  it('an agent can solve a multi-fault lab by repeating apply_suggested_fix', async () => {
    const { call } = await setup()
    call('netforge_load_lab', { labId: 'final-boss' })
    let completed = false
    for (let i = 0; i < 12 && !completed; i++) completed = call('netforge_apply_suggested_fix').data.labCompleted === true
    expect(completed).toBe(true)
    expect(call('netforge_get_state').data).toMatchObject({ completed: true, solvedNow: true })
  })

  it('apply_suggested_fix never completes a lab that is not actually restored', async () => {
    const { call } = await setup()
    call('netforge_load_lab', { labId: 'final-boss' })
    const first = call('netforge_apply_suggested_fix').data
    expect(first.connectivity.allPass).toBe(false)
    expect(first.labCompleted).toBe(false)
    expect(call('netforge_get_state').data.completed).toBe(false)
  })
})

describe('tools while an AI takeover is running', () => {
  async function startTakeover() {
    const s = await setup()
    vi.useFakeTimers()
    const started = s.call('netforge_take_over_lab')
    expect(started.isError).toBe(false)
    await vi.advanceTimersByTimeAsync(2500) // mid-run
    return s
  }

  it('reports the running takeover, refuses to double-start and refuses interleaved fixes', async () => {
    const { call } = await startTakeover()
    expect(call('netforge_get_state').data.takeover.running).toBe(true)
    const again = call('netforge_take_over_lab')
    expect(again.isError).toBe(true)
    expect(again.data.error).toMatch(/already running/)
    const fix = call('netforge_apply_suggested_fix')
    expect(fix.isError).toBe(true)
    expect(fix.data.error).toMatch(/takeover is running/)
    // read-only tools keep working mid-run
    expect(call('netforge_ping', { from: 'PC-01', to: 'SRV-01' }).isError).toBe(false)
    expect(call('netforge_diagnose').isError).toBe(false)
    await vi.runAllTimersAsync()
    const done = call('netforge_get_state').data
    expect(done.takeover.running).toBe(false)
    expect(done).toMatchObject({ completed: true, solvedNow: true })
  })

  it('loading another lab cancels the takeover: it neither completes nor mutates the new lab', async () => {
    const { call } = await startTakeover()
    const loaded = call('netforge_load_lab', { labId: 'nat-lab' }).data
    expect(loaded.interruptedTakeover).toBe(true)
    const before = JSON.stringify(useNetworkStore.getState().devices)
    await vi.runAllTimersAsync()
    expect(JSON.stringify(useNetworkStore.getState().devices)).toBe(before)
    expect(useNetworkStore.getState().completedLabs['wrong-gateway']).toBeUndefined()
    expect(useNetworkStore.getState().completedLabs['nat-lab']).toBeUndefined()
    expect(useCopilotStore.getState().labAssist.busy).toBe(false)
  })

  it('take_over_lab refuses when no topology is loaded', async () => {
    const { call } = await setup()
    useNetworkStore.getState().loadLab({ ...ALL_LABS[1], devices: [], links: [], failures: [] })
    const r = call('netforge_take_over_lab')
    expect(r.isError).toBe(true)
    expect(r.data.error).toMatch(/No lab loaded/)
  })
})
