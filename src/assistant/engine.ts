import { useCopilotStore } from '@/store/copilotStore'
import { runConnectivityMatrix } from './tools'
import { diagnosePing, formatMatrix } from './diagnose'
import { text, buildPlan, planMessage, executeChange, newId, MODE_HINT } from './engine.core'
import {
  handleConfigure,
  handleGateway,
  handleRoute,
  handleInterfaceStatus,
} from './engine.handlers'
import {
  handlePing,
  handleDiagnose,
  handleTests,
  handleCompleteLab,
  handleDeviceInfo,
  handleConcept,
} from './engine.handlers2'
import { getSelectedDevice, formatTopologyOverview } from './context'
import { parseCommand } from './parse'
import type { ParsedCommand } from './parse'
import type { AssistantMessage } from '@/assistant/types'

function handleGreet(): AssistantMessage[] {
  const selected = getSelectedDevice()
  const ctx = selected ? ` I see you have ${selected.hostname} selected — ask me anything about it.` : ''
  return [text(`Hey! 👋 I'm your lab copilot. I can see your topology, run diagnostics, and configure devices when you ask.${ctx}\nTry "why can't PC-01 ping SRV-01?" or "find the problem".`)]
}

function handleHelp(): AssistantMessage[] {
  return [text([
    'Here is what I can do — all on your LIVE topology:', '',
    'Diagnose: "Why can\'t PC-01 ping SRV-01?" / "Find the problem"',
    'Test: "Run connectivity tests"',
    'Configure: "Set PC-01 to 10.1.10.50/24 gateway 10.1.10.1"',
    'Routes: "Add a static route on R-02 to 10.1.20.0/24 via 10.1.0.6"',
    'Take over: "Complete this lab for me"', '',
    MODE_HINT[useCopilotStore.getState().mode],
  ].join('\n'))]
}

function handleUnknown(cmd: ParsedCommand): AssistantMessage[] {
  const selected = getSelectedDevice()
  const hint = selected ? `\nYou have ${selected.hostname} selected — "why is this device not working?" will use it.` : ''
  if (cmd.deviceRef) return handleDeviceInfo(cmd)
  return [text("I didn't catch that. I'm best at diagnosing, configuring, or fixing labs." + hint)]
}

function respond(raw: string): AssistantMessage[] {
  const cmd = parseCommand(raw)
  switch (cmd.intent) {
    case 'greet': return handleGreet()
    case 'help': return handleHelp()
    case 'configure': return handleConfigure(cmd)
    case 'gateway': return handleGateway(cmd)
    case 'route-add': return handleRoute(cmd, false)
    case 'route-remove': return handleRoute(cmd, true)
    case 'interface-status': return handleInterfaceStatus(cmd)
    case 'ping': return handlePing(cmd)
    case 'diagnose':
    case 'find-problems': return handleDiagnose(cmd)
    case 'tests': return handleTests()
    case 'complete-lab': return handleCompleteLab()
    case 'device-info': return handleDeviceInfo(cmd)
    case 'concept': return handleConcept(cmd)
    case 'topology': return [text(formatTopologyOverview())]
    default: return handleUnknown(cmd)
  }
}

export function handleMessage(raw: string): void {
  const trimmed = raw.trim()
  if (!trimmed) return
  const store = useCopilotStore.getState()
  store.pushMessage({ id: newId(), role: 'user', kind: 'text', text: trimmed })
  store.setStatus('thinking')
  window.setTimeout(() => {
    try {
      for (const reply of respond(trimmed)) useCopilotStore.getState().pushMessage(reply)
    } catch (error) {
      useCopilotStore.getState().pushMessage(text(`[FAIL] ${error instanceof Error ? error.message : String(error)}\nNo configuration changes were made.`))
    } finally {
      useCopilotStore.getState().setStatus('idle')
    }
  }, 350)
}

function extractIp(destination: string): string {
  const match = /\((\d{1,3}(?:\.\d{1,3}){3})\)/.exec(destination)
  return match?.[1] ?? destination
}

export function applyPlan(changeIds?: string[]): void {
  const store = useCopilotStore.getState()
  const plan = store.pendingPlan
  if (!plan) { store.pushMessage(text('No plan is currently pending.')); return }
  const changes = changeIds?.length ? plan.changes.filter((c) => changeIds.includes(c.id)) : plan.changes
  if (changes.length === 0) { store.setPendingPlan(null); store.pushMessage(text('Plan cancelled — no changes were made.')); return }
  store.setStatus('working')
  store.pushMessage(text(`Applying ${changes.length} change${changes.length === 1 ? '' : 's'}…`, { muted: true }))
  const results: string[] = []
  for (const change of changes) {
    const outcome = executeChange(change)
    results.push(`${outcome.ok ? '✅' : '❌'} ${change.summary}\n   ${outcome.report}`)
    store.addAction({ id: newId(), timestamp: new Date().toISOString(), message: `Applied: ${change.summary}`, type: outcome.ok ? 'success' : 'warning' })
  }
  store.pushMessage(text(results.join('\n')))
  const matrix = runConnectivityMatrix()
  const passing = matrix.filter((t) => t.success).length
  const summary = passing === matrix.length ? `Verification: all ${matrix.length} tests pass. 🎉` : `Verification: ${passing}/${matrix.length} tests pass — investigating…`
  store.pushMessage(text(`${summary}\n\n${formatMatrix(matrix)}`))
  store.setPendingPlan(null)
  store.setStatus('idle')
  if (passing < matrix.length) {
    const failing = matrix.find((t) => !t.success)
    if (failing) {
      const diagnosis = diagnosePing(failing.source, extractIp(failing.destination))
      store.pushMessage(text([`Still failing: ${failing.source} → ${failing.destination}`, '', diagnosis.explanation].join('\n')))
      if (diagnosis.fixes.length > 0) {
        const repair = buildPlan('Continue repair', ['Follow-up fix after verifying the previous plan.'], diagnosis.fixes)
        store.pushMessage(planMessage(repair, 'Next fix I can apply:'))
        store.setPendingPlan(repair)
      }
    }
  }
}

export function cancelPlan(): void {
  const store = useCopilotStore.getState()
  store.setPendingPlan(null)
  store.pushMessage(text('Cancelled — no changes were made. The plan is discarded; just ask if you want it again.'))
}
