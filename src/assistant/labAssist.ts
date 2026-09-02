import type { AssistStep } from '@/store/copilotStore'
import { useCopilotStore } from '@/store/copilotStore'
import { useNetworkStore } from '@/store/networkStore'
import { useUIStore } from '@/store/uiStore'
import { ping, runConnectivityMatrix } from './tools'
import { scanLab, formatMatrix } from './diagnose'
import { executeChange } from './engine.core'
import { requestLLMPlan } from './llm'

import type { ProposedChange } from './types'

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/** Sentinel thrown when the takeover run becomes stale (lab switched/exited). */
const STALE = Symbol('lab-assist-stale')

/**
 * Abort the takeover the moment the active lab changes or the user exits
 * assist mode. Prevents stale async runs from mutating or completing a lab
 * that is no longer on screen.
 */
function makeStaleGuard(labId: string, startEpoch: number) {
  return () => {
    const s = useCopilotStore.getState()
    return (
      s.assistEpoch !== startEpoch ||
      s.labAssist.labId !== labId ||
      useNetworkStore.getState().lab.id !== labId
    )
  }
}

async function pause(ms: number, isStale: () => boolean) {
  await delay(ms)
  if (isStale()) throw STALE
}

/**
 * Run a REAL ping and animate the packet along the simulator's actual path on
 * the topology canvas (via the existing packetTrace system). Everything shown
 * is driven by live network state - nothing is prerecorded.
 */
async function animateTest(
  sourceRef: string,
  destinationRef: string,
  isStale: () => boolean,
): Promise<{ ok: boolean; detail: string }> {
  const result = ping(sourceRef, destinationRef)
  if (!result.ok || !result.data) return { ok: false, detail: result.error ?? 'Ping failed.' }
  const { hops, success, detail } = result.data
  useNetworkStore.getState().setPacketTrace({ id: crypto.randomUUID(), path: hops ?? [], success })
  // Match the canvas animation length (600 + hops*220 ms) plus its clear delay.
  await pause(700 + (hops?.length ?? 2) * 220 + 450, isStale)
  return { ok: success, detail }
}

function setSteps(steps: AssistStep[]) {
  useCopilotStore.getState().setLabAssistSteps(steps)
}

function push(text: string) {
  useCopilotStore.getState().pushMessage({
    id: crypto.randomUUID(),
    role: 'assistant',
    kind: 'text',
    text,
  })
}

/** Best-effort CLI-looking echo for a proposed change, shown in the live feed. */
function commandEcho(change: ProposedChange): string {
  const p = change.payload as {
    interfaceRef?: string
    ip?: string
    mask?: string
    prefix?: number
    status?: 'up' | 'down'
    gateway?: string
    destination?: string
    nextHop?: string
    linkId?: string
  }
  const host = change.deviceName ?? change.deviceRef ?? 'device'
  switch (change.kind) {
    case 'gateway':
      return `> ${host} set gateway ${p.gateway ?? ''}`
    case 'interface':
      return `> ${host} ip ${p.ip ?? ''} ${p.mask ?? (p.prefix ? `/${p.prefix}` : '')}`
    case 'interface-status':
      return `> ${host} interface ${p.interfaceRef ?? ''} ${p.status ?? 'up'}`
    case 'route-add':
      return `> ${host} ip route ${p.destination ?? ''} ${p.nextHop ?? ''}`
    case 'route-remove':
      return `> ${host} no ip route ${p.destination ?? ''}`
    case 'link-status':
      return `> ${host} no shutdown (restore link)`
    default:
      return `> ${change.summary}`
  }
}

/**
 * Take over the loaded lab: detect its real fault, walk the student through a
 * visible step-by-step timeline, apply each fix, verify, and mark the lab as
 * completed in the Lab Library when every connectivity test passes.
 */
export async function runLabAssist(labId: string) {
  const store = useCopilotStore.getState()

  // Never allow two takeover drivers to interleave on the same lab.
  if (store.labAssist.busy) return

  const net = useNetworkStore.getState()
  const lab = net.lab
  const isStale = makeStaleGuard(labId, store.assistEpoch)
  // All waits below abort the run the moment the lab changes or assist is exited.
  const delay = async (ms: number) => pause(ms, isStale)

  // Nothing broken yet.
  const line = (text: string, tone: 'info' | 'ok' | 'warn' | 'cmd' | 'header' = 'info') =>
    store.pushTakeoverLine(text, tone)

  const initialScan = scanLab()
  const { problems, matrix } = initialScan
  let plan = initialScan.plan

  // Consult the LLM first (when KIMI_API_KEY is configured on the server):
  // it sees the same live state and proposes changes in the same schema -
  // invalid items are dropped client-side, so nothing unsafe can execute.
  // If the LLM is unavailable, unconfigured, or returns nothing usable, the
  // local rule-based planner above is used unchanged.
  const aiPlan = await requestLLMPlan()
  if (isStale()) throw STALE
  if (aiPlan) {
    plan = aiPlan.changes
    if (aiPlan.reasoning) push(`🤖 AI diagnosis: ${aiPlan.reasoning}`)
  }

  // Nothing to automate - still give a visible takeover moment.
  if (plan.length === 0) {
    store.startLabAssist(labId, [])
    store.setTakeoverPhase('working')
    line('🤖 AI TAKEOVER', 'header')
    await delay(600)
    line('Analyzing the network...')
    await delay(800)
    const allPass = matrix.every((t) => t.success)
    if (allPass) {
      line('✓ Topology identified', 'ok')
      await delay(400)
      line('Running connectivity tests...')
      await delay(800)
      line('✓ All tests passing - nothing to fix', 'ok')
      store.setTakeoverSummary(
        `I analyzed "${lab.title}" and everything is already healthy -\nall connectivity tests pass. Nothing needed fixing.\n\n✓ Lab objective completed`,
      )
      store.setTakeoverPhase('summary')
      net.completeLab(labId, true)
      return
    }
    await delay(400)
    line('⚠ Found issues I can\'t safely automate', 'warn')
    await delay(600)
    store.setTakeoverPhase('idle')
    store.stopLabAssist()
    push(
      [
        `I checked \"${lab.title}\" - here's what I found:`,
        '',
        ...problems.map((p) => `${p.severity === 'critical' ? '🔴' : p.severity === 'warning' ? '🟠' : '🔵'} ${p.summary}`),
        '',
        'I couldn\'t find safe automatic fixes for these - they likely need manual topology changes (cabling, new devices, etc.).',
        'Try asking me "why can\'t PC-01 ping SRV-01?" and I\'ll walk you through the fix step by step.',
      ].join('\n'),
    )
    return
  }

  // Every plan change becomes a visible timeline step, with a verify step at the end.
  const fixSteps: AssistStep[] = plan.map((change, i) => ({
    id: `fix-${i}`,
    label: change.summary,
    detail: change.detail ?? 'Applying configuration',
    status: 'pending',
  }))
  const steps: AssistStep[] = [
    { id: 'inspect', label: 'Inspecting the lab', detail: 'Running reachability audit', status: 'active' },
    ...fixSteps,
    { id: 'verify', label: 'Verifying connectivity', detail: 'Re-running every test', status: 'pending' },
  ]

  store.startLabAssist(labId, steps)
  store.setTakeoverPhase('working') // make the live takeover overlay visible
  store.setStatus('working')

  const advance = (idx: number, status: 'active' | 'done') =>
    setSteps(
      steps.map((s, i) => {
        if (i === idx) return { ...s, status }
        if (i < idx) return { ...s, status: 'done' }
        return { ...s, status: 'pending' }
      }),
    )

  const markAllDone = () => setSteps(steps.map((s) => ({ ...s, status: 'done' })))

  try {
    // ---- Live takeover sequence on the real lab UI ----
    useUIStore.getState().setActiveView('topology')
    await delay(700)
    line('Analyzing the network...', 'info')
    await delay(900)
    line('✓ Topology identified', 'ok')
    await delay(500)

    // ---- Live inspection on the REAL topology: highlight each affected host,
    // narrate its config vs the on-link router, and animate a FAILING ping
    // along the simulator's actual path. All driven by live state. ----
    const seenSources = new Set<string>()
    for (const failure of matrix.filter((t) => !t.success)) {
      if (seenSources.has(failure.source)) continue
      seenSources.add(failure.source)
      const device = net.devices.find((d) => d.hostname === failure.source)
      if (!device) continue
      net.setHighlightedDevice(device.id)
      line(`Inspecting ${failure.source} configuration...`, 'info')
      await delay(700)
      const gwFix = plan.find((c) => c.kind === 'gateway' && c.deviceRef === failure.source)
      const correctGw = gwFix ? (gwFix.payload as { gateway?: string }).gateway : undefined
      if (correctGw) {
        line(`${failure.source} configured gateway: ${device.defaultGateway ?? '(none)'}`, 'cmd')
        await delay(550)
        line(`Router on ${failure.source}'s subnet: ${correctGw}`, 'cmd')
        await delay(550)
        line(`⚠ Gateway mismatch detected on ${failure.source}`, 'warn')
        await delay(450)
      }
      const destIp = /\((\d{1,3}(?:\.\d{1,3}){3})\)/.exec(failure.destination)?.[1] ?? failure.destination
      line(`Testing ${failure.source} → ${destIp}...`, 'info')
      await delay(300)
      const test = await animateTest(failure.source, destIp, isStale)
      line(test.ok ? '✓ Connection successful' : `✗ ${test.detail}`, test.ok ? 'ok' : 'warn')
      await delay(400)
    }
    net.setHighlightedDevice(null)

    const applied: ProposedChange[] = []
    let matrixAfter = matrix
    let success = false

    // Up to 3 diagnose → apply → verify rounds: after each pass the AI
    // re-diagnoses the live network (LLM first, local scan as fallback), so
    // cascading faults get fixed visibly too.
    for (let round = 1; round <= 3; round++) {
      let scan = round === 1 ? { problems, plan, matrix } : scanLab()
      if (round > 1) {
        const ai = await requestLLMPlan()
        if (isStale()) throw STALE
        if (ai) scan = { ...scan, plan: ai.changes }
      }
      if (scan.plan.length === 0) {
        if (scan.matrix.every((t) => t.success)) {
          success = true
          matrixAfter = scan.matrix
        }
        break
      }
      if (round > 1) {
        line(`Round ${round} - re-diagnosing...`, 'info')
        await delay(700)
      }

      for (let i = 0; i < scan.plan.length; i++) {
        const change = scan.plan[i]
        const host = change.deviceName ?? change.deviceRef ?? 'device'
        if (i < fixSteps.length) advance(i + 1, 'active')

        line(`Connecting to ${host}...`, 'info')
        await delay(600)
        if (change.deviceRef) net.setHighlightedDevice(change.deviceRef)
        line(commandEcho(change), 'cmd')
        await delay(700)
        // Narrate the concrete configuration change (e.g. gateway OLD → NEW).
        if (change.kind === 'gateway') {
          const before = net.devices.find((d) => d.hostname === host)?.defaultGateway
          line(`${host} gateway: ${before ?? '(none)'} → ${(change.payload as { gateway?: string }).gateway}`, 'warn')
        }
        line(`${change.detail ?? 'Applying configuration'}...`, 'info')
        await delay(500)

        const outcome = executeChange(change)
        store.addAction({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          message: `Applied: ${change.summary}`,
          type: outcome.ok ? 'success' : 'warning',
        })
        line(outcome.ok ? `✓ ${change.summary}` : `⚠ ${change.summary} (check manually)`, outcome.ok ? 'ok' : 'warn')
        push(`${outcome.ok ? '✅' : '❌'} ${host}: ${change.summary}\n${outcome.report}`)
        applied.push(change)
        await delay(650)
        net.setHighlightedDevice(null)
      }

    // ---- Verify all connectivity, visibly ----
    advance(steps.length - 1, 'active')
    line('Verifying lab objective...', 'info')
    await delay(700)
    matrixAfter = runConnectivityMatrix()
    const passing = matrixAfter.filter((t) => t.success).length
    if (passing === matrixAfter.length) {
      success = true
      break
    }
    if (round < 3) {
      line(`⚠ ${passing}/${matrixAfter.length} tests passing - re-diagnosing...`, 'warn')
      await delay(800)
    }
    }

    if (success) {
      markAllDone()
      // Verification packets travel the REAL topology along the simulator's path.
      for (const t of matrixAfter.slice(0, 3)) {
        const src = net.devices.find((d) => d.hostname === t.source)
        if (src) net.setHighlightedDevice(src.id)
        line(`> ping ${t.destination ?? ''}`, 'cmd')
        await delay(250)
        const destIp = /\((\d{1,3}(?:\.\d{1,3}){3})\)/.exec(t.destination)?.[1] ?? t.destination
        const test = await animateTest(t.source, destIp, isStale)
        line(test.ok ? '✓ Connection successful' : `✗ ${test.detail}`, test.ok ? 'ok' : 'warn')
        net.setHighlightedDevice(null)
        await delay(250)
      }
      if (matrixAfter.length > 4) {
        line(`✓ ${matrixAfter.length} connectivity tests passing`, 'ok')
      }
      await delay(500)

      // Keep the takeover phase at 'summary' so the overlay typewrites the
      // explanation, then the overlay itself moves to 'complete' and redirects.
      net.completeLab(labId, true)
      push(`✅ Verification passed - all ${matrixAfter.length} connectivity tests are green.\n\n${formatMatrix(matrixAfter)}`)
      store.setTakeoverSummary(
        [
          `🤖 AI completed the lab.`,
          '',
          `I found and fixed ${applied.length === 1 ? 'an issue' : `${applied.length} issues`} in "${lab.title}":`,
          ...applied.map((c) => `✅ ${c.summary}`),
          '',
          `I corrected the configuration and re-tested every`,
          `connectivity path in the topology.`,
          '',
          `✓ All ${matrixAfter.length} tests passing`,
          `✓ Lab objective completed`,
        ].join('\n'),
      )
      store.setTakeoverPhase('summary')
    } else {
      markAllDone()
      const passingNow = matrixAfter.filter((t) => t.success).length
      line(`⚠ ${passingNow}/${matrixAfter.length} tests passing`, 'warn')
      await delay(600)
      store.setTakeoverPhase('idle')
      store.stopLabAssist()
      push(
        [
          `I dug into "${lab.title}" and got ${passingNow}/${matrixAfter.length} tests passing, but ran out of safe automatic fixes.`,
          '',
          'What I fixed along the way:',
          ...(applied.length ? applied.map((c) => `✅ ${c.summary}`) : ['- nothing was safely automatable']),
          '',
          'Current results:',
          formatMatrix(matrixAfter),
          '',
          `Ask me to "find the problem" and I'll explain what's still broken.`,
        ].join('\n'),
      )
    }
  } catch (error) {
    // Stale run (lab switched / assist exited) - silently abort, never touch
    // the state of whatever lab is active now.
    if (error === STALE) return
    store.setTakeoverPhase('idle')
    store.stopLabAssist()
    push(`[ERROR] ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    if (isStale()) return
    store.setStatus('idle')
    store.setLabAssistBusy(false)
    net.setHighlightedDevice(null)
  }
}