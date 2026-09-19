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
 * diagnose, fix and complete labs end to end. Arguments come from an untrusted
 * agent: every one is validated, and a lab is only ever marked complete by the
 * simulator-backed verifier (never because a tool "said" it worked).
 */
import { initializeWebMCPPolyfill } from '@mcp-b/webmcp-polyfill'

import { ALL_LABS } from '@/data/labs'
import { useNetworkStore } from '@/store/networkStore'
import { useCopilotStore } from '@/store/copilotStore'
import { useUIStore, type View } from '@/store/uiStore'
import { ping, runConnectivityMatrix } from '@/assistant/tools'
import { scanLab, formatMatrix } from '@/assistant/diagnose'
import { executeChange } from '@/assistant/engine.core'
import { runLabAssist } from '@/assistant/labAssist'
import { formatTopologyOverview } from '@/assistant/context'
import { verifyAndCompleteLab, verifyLab } from '@/features/labs/verification'

/** Allowed values for netforge_set_view (mirrors the View union in uiStore). */
export const VIEWS = ['learn', 'devicelab', 'topology', 'issues', 'labs', 'traffic', 'terminal', 'settings'] as const satisfies readonly View[]

const MAX_ARG_CHARS = 64

type Args = Record<string, unknown>

export interface ToolResult {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

export interface NetForgeTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (args: Args) => ToolResult
}

/** Wrap any value as a standard WebMCP tool result. */
function ok(payload: unknown): ToolResult {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
  return { content: [{ type: 'text', text }] }
}

function fail(error: string, extra: Record<string, unknown> = {}): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ ok: false, error, ...extra }, null, 2) }], isError: true }
}

/** A required, bounded, non-blank string argument - or an error message. */
function requireString(args: Args, key: string): { value: string } | { error: string } {
  const raw = args?.[key]
  if (typeof raw !== 'string') return { error: `"${key}" is required and must be a string.` }
  const value = raw.trim()
  if (!value) return { error: `"${key}" must not be empty.` }
  if (value.length > MAX_ARG_CHARS) return { error: `"${key}" is too long (max ${MAX_ARG_CHARS} characters).` }
  return { value }
}

function takeoverBusy(): boolean {
  return useCopilotStore.getState().labAssist.busy
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
  const assist = useCopilotStore.getState().labAssist
  return {
    id: lab.id,
    title: lab.title,
    difficulty: lab.difficulty,
    description: lab.description,
    injectedFaults: lab.failures?.length ?? 0,
    completed: !!completedLabs[lab.id]?.completed,
    solvedNow: verifyLab().solved,
    devices: devices.length,
    links: links.length,
    openIssues: issues.length,
    takeover: { running: assist.busy, phase: assist.phase, outcome: assist.outcome },
  }
}

const NO_ARGS = { type: 'object', properties: {}, additionalProperties: false }

/** The 10 tools NetForge exposes. Pure definitions - registration is separate. */
export function buildTools(): NetForgeTool[] {
  return [
    /* ─────────────────────────── read-only tools ─────────────────────────── */
    {
      name: 'netforge_list_labs',
      description: 'List every NetForge troubleshooting lab: id, title, difficulty, number of injected faults, and description.',
      inputSchema: NO_ARGS,
      execute: () =>
        ok(
          ALL_LABS.map((l) => ({
            id: l.id,
            title: l.title,
            difficulty: l.difficulty,
            injectedFaults: l.failures?.length ?? l.issueCount ?? 0,
            description: l.description,
          })),
        ),
    },
    {
      name: 'netforge_get_state',
      description:
        'Get the currently loaded lab: title, difficulty, device/link counts, open issue count, whether it is solved right now and already recorded as completed, and the state of any running AI takeover.',
      inputSchema: NO_ARGS,
      execute: () => ok(labSummary()),
    },
    {
      name: 'netforge_get_topology',
      description:
        'Get a full text description of the live topology: every device with its interfaces/IPs/gateway/routes, every link and its status, and detected issues.',
      inputSchema: NO_ARGS,
      execute: () => ok(formatTopologyOverview()),
    },
    {
      name: 'netforge_run_connectivity_tests',
      description: 'Ping every PC/server pair through the simulator and return how many paths pass, plus each failing pair and why.',
      inputSchema: NO_ARGS,
      execute: () => {
        const matrix = runConnectivityMatrix()
        return ok(`${matrix.filter((t) => t.success).length}/${matrix.length} paths passing\n\n${formatMatrix(matrix)}`)
      },
    },
    {
      name: 'netforge_ping',
      description:
        'Ping from one device to another (hostnames like "PC-01" / "SRV-01", or an IP). Returns success, latency and the hop path.',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Source device hostname, e.g. PC-01', maxLength: MAX_ARG_CHARS },
          to: { type: 'string', description: 'Destination hostname or IP, e.g. SRV-01 or 10.1.20.10', maxLength: MAX_ARG_CHARS },
        },
        required: ['from', 'to'],
        additionalProperties: false,
      },
      execute: (args) => {
        const from = requireString(args, 'from')
        if ('error' in from) return fail(from.error)
        const to = requireString(args, 'to')
        if ('error' in to) return fail(to.error)
        const res = ping(from.value, to.value)
        if (!res.ok || !res.data) return ok({ reachable: false, error: res.error })
        return ok({
          reachable: res.data.success,
          from: res.data.source,
          to: res.data.destination,
          detail: res.data.detail,
          hops: res.data.hops,
        })
      },
    },
    {
      name: 'netforge_diagnose',
      description:
        "Run NetForge's root-cause analysis on the live network. Returns the detected problems and the concrete fix plan it would apply (no changes are made).",
      inputSchema: NO_ARGS,
      execute: () => {
        const { problems, plan } = scanLab()
        return ok({
          problems: problems.map((p) => `[${p.severity}] ${p.summary} — ${p.detail}`),
          proposedFixes: plan.map((c) => c.summary),
        })
      },
    },

    /* ──────────────────────────── action tools ───────────────────────────── */
    {
      name: 'netforge_load_lab',
      description:
        "Load a lab by id (get ids from netforge_list_labs). Replaces the current topology with that lab's injected fault and switches the app to the topology view. Cancels any AI takeover in progress.",
      inputSchema: {
        type: 'object',
        properties: { labId: { type: 'string', description: 'Lab id, e.g. "wrong-gateway"', maxLength: MAX_ARG_CHARS } },
        required: ['labId'],
        additionalProperties: false,
      },
      execute: (args) => {
        const id = requireString(args, 'labId')
        if ('error' in id) return fail(id.error)
        const lab = ALL_LABS.find((l) => l.id === id.value)
        if (!lab) return fail(`No lab "${id.value}". Call netforge_list_labs for valid ids.`)
        const interrupted = takeoverBusy()
        useNetworkStore.getState().loadLab(lab)
        useUIStore.getState().setActiveView('topology')
        return ok({ ok: true, loaded: labSummary(), connectivity: matrixSummary(), interruptedTakeover: interrupted })
      },
    },
    {
      name: 'netforge_apply_suggested_fix',
      description:
        "Apply the single highest-priority fix from NetForge's diagnosis to the live network, then re-test connectivity. Call repeatedly to fix multi-fault labs. Refused while an AI takeover is running.",
      inputSchema: NO_ARGS,
      execute: () => {
        if (takeoverBusy()) return fail('An AI takeover is running on this lab. Wait for it to finish, or load a lab to cancel it.')
        const change = scanLab().plan[0]
        if (!change) return ok({ ok: false, note: 'Nothing to fix — no proposed change.', connectivity: matrixSummary() })
        const outcome = executeChange(change)
        const connectivity = matrixSummary()
        // Only the simulator-backed verifier may record a completion.
        const { lab } = useNetworkStore.getState()
        const verification = connectivity.allPass ? verifyAndCompleteLab(lab.id, false) : undefined
        return ok({
          ok: outcome.ok,
          applied: change.summary,
          report: outcome.report,
          connectivity,
          labCompleted: !!verification?.solved,
        })
      },
    },
    {
      name: 'netforge_take_over_lab',
      description:
        "Hand the current lab to NetForge's AI takeover: it diagnoses, applies validated fixes step by step on the live topology, verifies every connectivity test against the simulator, and marks the lab complete only if they pass. Returns immediately; the run plays out in the UI over ~15-30s.",
      inputSchema: NO_ARGS,
      execute: () => {
        const { lab, devices } = useNetworkStore.getState()
        if (devices.length === 0) return fail('No lab loaded. Call netforge_load_lab first.')
        if (takeoverBusy()) return fail('An AI takeover is already running.')
        void runLabAssist(lab.id).catch((err) => console.warn('[webmcp] takeover rejected:', err))
        return ok({
          ok: true,
          note: `AI takeover started for "${lab.id}". Poll netforge_get_state (takeover.running / completed) to see it finish.`,
        })
      },
    },
    {
      name: 'netforge_set_view',
      description: `Switch the NetForge app to a view: ${VIEWS.join(', ')}.`,
      inputSchema: {
        type: 'object',
        properties: { view: { type: 'string', enum: [...VIEWS] } },
        required: ['view'],
        additionalProperties: false,
      },
      execute: (args) => {
        const view = requireString(args, 'view')
        if ('error' in view) return fail(view.error)
        if (!(VIEWS as readonly string[]).includes(view.value)) {
          return fail(`Unknown view "${view.value}".`, { validViews: VIEWS })
        }
        useUIStore.getState().setActiveView(view.value as View)
        return ok({ ok: true, view: view.value })
      },
    },
  ]
}

/** Run a tool, turning any thrown error into a structured tool error. */
function safely(tool: NetForgeTool) {
  return (args: unknown): ToolResult => {
    try {
      return tool.execute(args !== null && typeof args === 'object' && !Array.isArray(args) ? (args as Args) : {})
    } catch (err) {
      console.warn(`[webmcp] ${tool.name} failed:`, err)
      return fail(`${tool.name} failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }
}

let inFlight: Promise<void> | null = null
let registered = false

/** Test hook: forget that registration happened. */
export function resetWebMCPRegistrationForTests(): void {
  inFlight = null
  registered = false
}

async function doRegister(): Promise<void> {
  if (typeof document === 'undefined') return

  // Native `document.modelContext` first; polyfill only when it's missing.
  if (!('modelContext' in document) || !document.modelContext) {
    // installTestingShim adds navigator.modelContextTesting (list/execute),
    // which lets you smoke-test the tools from the console / a test harness.
    initializeWebMCPPolyfill({ installTestingShim: true })
  }
  const mc = document.modelContext
  if (!mc) throw new Error('no document.modelContext after polyfill')

  const existing = new Set<string>()
  try {
    for (const t of (await mc.getTools?.()) ?? []) {
      const name = (t as { name?: unknown }).name
      if (typeof name === 'string') existing.add(name)
    }
  } catch {
    // getTools is optional; fall through to per-tool duplicate handling
  }

  for (const tool of buildTools()) {
    if (existing.has(tool.name)) continue // already registered (HMR / another script)
    try {
      await mc.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: safely(tool),
      })
    } catch (err) {
      // A duplicate or a rejected tool must never take the others (or the app) down.
      console.warn(`[webmcp] failed to register ${tool.name}:`, err)
    }
  }
  registered = true
  console.info('[webmcp] NetForge registered', (await mc.getTools?.().catch(() => []))?.length ?? '?', 'tools')
}

/**
 * Idempotent: concurrent and repeated calls share one registration. A failed
 * attempt (polyfill init error) is not cached, so a later call can retry.
 */
export function registerNetForgeWebMCP(): Promise<void> {
  if (registered) return Promise.resolve()
  inFlight ??= doRegister().catch((err) => {
    inFlight = null
    throw err
  })
  return inFlight
}
