/**
 * WebMCP integration — exposes NetForge as callable tools to any AI agent that
 * drives the browser (ChatGPT's in-app browser, Chrome 146+ with WebMCP, or a
 * WebMCP browser extension).
 *
 * Tools are registered on `document.modelContext` (the W3C Web Model Context
 * API). Chrome ships it only behind a flag / origin trial today, so we install
 * the `@mcp-b/webmcp-polyfill` when the native API is absent.
 *
 * Every tool runs REAL code against the live simulator stores — the same
 * functions the in-app copilot uses — so an external agent can inspect, load,
 * diagnose, fix and complete labs end to end.
 */
import { initializeWebMCPPolyfill } from '@mcp-b/webmcp-polyfill'

import { ALL_LABS } from '@/data/labs'
import { useNetworkStore } from '@/store/networkStore'
import { useUIStore } from '@/store/uiStore'
import { ping, runConnectivityMatrix } from '@/assistant/tools'
import { scanLab, formatMatrix } from '@/assistant/diagnose'
import { executeChange } from '@/assistant/engine.core'
import { runLabAssist } from '@/assistant/labAssist'
import { formatTopologyOverview } from '@/assistant/context'

/** Wrap any value as a standard WebMCP tool result. */
function ok(payload: unknown) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
  return { content: [{ type: 'text' as const, text }] }
}

function matrixSummary() {
  const matrix = runConnectivityMatrix()
  const passing = matrix.filter((t) => t.success).length
  return {
    passing,
    total: matrix.length,
    allPass: matrix.length > 0 && passing === matrix.length,
    failing: matrix.filter((t) => !t.success).map((t) => `${t.source} → ${t.destination}: ${t.detail}`),
  }
}

function labSummary() {
  const { lab, devices, links, issues, completedLabs } = useNetworkStore.getState()
  return {
    id: lab.id,
    title: lab.title,
    difficulty: lab.difficulty,
    description: lab.description,
    injectedFaults: lab.failures?.length ?? 0,
    completed: !!completedLabs[lab.id]?.completed,
    devices: devices.length,
    links: links.length,
    openIssues: issues.length,
  }
}

let registered = false

export async function registerNetForgeWebMCP(): Promise<void> {
  if (registered) return
  registered = true

  // Native `document.modelContext` first; polyfill only when it's missing.
  if (typeof document === 'undefined') return
  if (!('modelContext' in document) || !document.modelContext) {
    try {
      // installTestingShim adds navigator.modelContextTesting (list/execute),
      // which lets you smoke-test the tools from the console / a test harness.
      initializeWebMCPPolyfill({ installTestingShim: true })
    } catch (err) {
      console.warn('[webmcp] polyfill init failed:', err)
      return
    }
  }
  const mc = document.modelContext
  if (!mc) {
    console.warn('[webmcp] no document.modelContext after polyfill — skipping tool registration')
    return
  }

  const register = (
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    execute: (args: Record<string, unknown>) => unknown | Promise<unknown>,
  ) =>
    mc
      .registerTool({ name, description, inputSchema, execute: (a) => execute(a as Record<string, unknown>) })
      .catch((err: unknown) => console.warn(`[webmcp] failed to register ${name}:`, err))

  const NO_ARGS = { type: 'object', properties: {}, additionalProperties: false }

  /* ─────────────────────────── read-only tools ─────────────────────────── */

  await register(
    'netforge_list_labs',
    'List every NetForge troubleshooting lab: id, title, difficulty, number of injected faults, and description.',
    NO_ARGS,
    () =>
      ok(
        ALL_LABS.map((l) => ({
          id: l.id,
          title: l.title,
          difficulty: l.difficulty,
          injectedFaults: l.failures?.length ?? l.issueCount ?? 0,
          description: l.description,
        })),
      ),
  )

  await register(
    'netforge_get_state',
    'Get the currently loaded lab: title, difficulty, device/link counts, open issue count, and whether it is already solved.',
    NO_ARGS,
    () => ok(labSummary()),
  )

  await register(
    'netforge_get_topology',
    'Get a full text description of the live topology: every device with its interfaces/IPs/gateway/routes, every link and its status, and detected issues.',
    NO_ARGS,
    () => ok(formatTopologyOverview()),
  )

  await register(
    'netforge_run_connectivity_tests',
    'Ping every PC/server pair through the simulator and return how many paths pass, plus each failing pair and why.',
    NO_ARGS,
    () => {
      const matrix = runConnectivityMatrix()
      return ok(`${matrix.filter((t) => t.success).length}/${matrix.length} paths passing\n\n${formatMatrix(matrix)}`)
    },
  )

  await register(
    'netforge_ping',
    'Ping from one device to another (hostnames like "PC-01" / "SRV-01", or an IP). Returns success, latency and the hop path.',
    {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Source device hostname, e.g. PC-01' },
        to: { type: 'string', description: 'Destination hostname or IP, e.g. SRV-01 or 10.1.20.10' },
      },
      required: ['from', 'to'],
      additionalProperties: false,
    },
    ({ from, to }) => {
      const res = ping(String(from), String(to))
      if (!res.ok || !res.data) return ok({ reachable: false, error: res.error })
      return ok({
        reachable: res.data.success,
        from: res.data.source,
        to: res.data.destination,
        detail: res.data.detail,
        hops: res.data.hops,
      })
    },
  )

  await register(
    'netforge_diagnose',
    'Run NetForge\'s root-cause analysis on the live network. Returns the detected problems and the concrete fix plan it would apply (no changes are made).',
    NO_ARGS,
    () => {
      const { problems, plan } = scanLab()
      return ok({
        problems: problems.map((p) => `[${p.severity}] ${p.summary} — ${p.detail}`),
        proposedFixes: plan.map((c) => c.summary),
      })
    },
  )

  /* ──────────────────────────── action tools ───────────────────────────── */

  await register(
    'netforge_load_lab',
    'Load a lab by id (get ids from netforge_list_labs). Replaces the current topology with that lab\'s injected fault and switches the app to the topology view.',
    {
      type: 'object',
      properties: { labId: { type: 'string', description: 'Lab id, e.g. "wrong-gateway"' } },
      required: ['labId'],
      additionalProperties: false,
    },
    ({ labId }) => {
      const lab = ALL_LABS.find((l) => l.id === String(labId))
      if (!lab) return ok({ ok: false, error: `No lab "${labId}". Call netforge_list_labs for valid ids.` })
      useNetworkStore.getState().loadLab(lab)
      useUIStore.getState().setActiveView('topology')
      return ok({ ok: true, loaded: labSummary(), connectivity: matrixSummary() })
    },
  )

  await register(
    'netforge_apply_suggested_fix',
    'Apply the single highest-priority fix from NetForge\'s diagnosis to the live network, then re-test connectivity. Call repeatedly to fix multi-fault labs.',
    NO_ARGS,
    () => {
      const change = scanLab().plan[0]
      if (!change) return ok({ ok: false, note: 'Nothing to fix — no proposed change.', connectivity: matrixSummary() })
      const outcome = executeChange(change)
      const connectivity = matrixSummary()
      // Fully restored → record the completion, same as the in-app verification.
      let completed = false
      if (connectivity.allPass) {
        const { lab } = useNetworkStore.getState()
        if (lab.devices.length > 0 && lab.id !== 'starter') {
          useNetworkStore.getState().completeLab(lab.id, false)
          completed = true
        }
      }
      return ok({ ok: outcome.ok, applied: change.summary, report: outcome.report, connectivity, labCompleted: completed })
    },
  )

  await register(
    'netforge_take_over_lab',
    'Hand the current lab to NetForge\'s AI takeover: it diagnoses, applies fixes step by step on the live topology, verifies every connectivity test, and marks the lab complete. Returns immediately; the run plays out in the UI over ~15-30s.',
    NO_ARGS,
    () => {
      const labId = useNetworkStore.getState().lab.id
      if (useNetworkStore.getState().devices.length === 0) {
        return ok({ ok: false, error: 'No lab loaded. Call netforge_load_lab first.' })
      }
      void runLabAssist(labId).catch((err) => console.warn('[webmcp] takeover rejected:', err))
      return ok({ ok: true, note: `AI takeover started for "${labId}". Poll netforge_run_connectivity_tests / netforge_get_state to see it finish.` })
    },
  )

  await register(
    'netforge_set_view',
    'Switch the NetForge app to a view: dashboard, topology, issues, labs, traffic, terminal, learn, devicelab or settings.',
    {
      type: 'object',
      properties: {
        view: {
          type: 'string',
          enum: ['dashboard', 'topology', 'issues', 'labs', 'traffic', 'terminal', 'learn', 'devicelab', 'settings'],
        },
      },
      required: ['view'],
      additionalProperties: false,
    },
    ({ view }) => {
      useUIStore.getState().setActiveView(view as never)
      return ok({ ok: true, view })
    },
  )

  console.info('[webmcp] NetForge registered', (await mc.getTools?.().catch(() => []))?.length ?? '?', 'tools')
}
