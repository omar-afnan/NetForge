import { useNetworkStore } from '@/store/networkStore'
import type { AssistantMessage, LabPlan, MessageAction, ProposedChange } from './types'
import {
  addStaticRoute,
  configureGateway,
  configureInterface,
  removeStaticRoute,
  setInterfaceStatus,
} from './tools'
import { prefixToMask } from '@/network/ip'
import { useCopilotStore } from '@/store/copilotStore'
import { resolveDevice } from './context'
import type { Device } from '@/network/types'

export function newId(): string {
  return crypto.randomUUID()
}

export function text(body: string, extra?: Partial<AssistantMessage>): AssistantMessage {
  return { id: newId(), role: 'assistant', kind: 'text', text: body, ...extra }
}

export function planMessage(plan: LabPlan, intro: string): AssistantMessage {
  const apply: MessageAction = { id: newId(), label: `Apply ${plan.changes.length} change${plan.changes.length === 1 ? '' : 's'}`, kind: 'apply-plan', style: 'primary' }
  const cancel: MessageAction = { id: newId(), label: 'Cancel', kind: 'cancel-plan', style: 'ghost' }
  return { id: newId(), role: 'assistant', kind: 'plan', text: intro, planId: plan.id, actions: [apply, cancel] }
}

export function buildPlan(title: string, rationale: string[], changes: ProposedChange[]): LabPlan {
  return { id: newId(), title, rationale, changes }
}

/** Execute one proposed change through the real store-backed tools. */
export function executeChange(change: ProposedChange): { ok: boolean; report: string } {
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
  switch (change.kind) {
    case 'gateway':
      return wrap(configureGateway({ deviceRef: change.deviceRef, gateway: p.gateway }))
    case 'interface':
      return wrap(configureInterface({ deviceRef: change.deviceRef, interfaceRef: p.interfaceRef, ip: p.ip, mask: p.mask, prefix: p.prefix }))
    case 'interface-status':
      return wrap(setInterfaceStatus({ deviceRef: change.deviceRef, interfaceRef: p.interfaceRef, status: p.status ?? 'up' }))
    case 'route-add':
      if (!p.destination || !p.nextHop) return { ok: false, report: 'Incomplete route payload.' }
      return wrap(addStaticRoute({ deviceRef: change.deviceRef, destination: p.destination, mask: p.mask, prefix: p.prefix, nextHop: p.nextHop }))
    case 'route-remove':
      if (!p.destination) return { ok: false, report: 'Incomplete route payload.' }
      return wrap(removeStaticRoute({ deviceRef: change.deviceRef, destination: p.destination, mask: p.mask, prefix: p.prefix }))
    case 'link-status': {
      if (!p.linkId) return { ok: false, report: 'Missing link id.' }
      useNetworkStore.getState().setLinkStatus(p.linkId, p.status ?? 'up')
      return { ok: true, report: 'Link restored.' }
    }
    default:
      return { ok: false, report: `Unsupported change kind: ${change.kind}` }
  }
}

export function wrap(result: { ok: boolean; error?: string; data?: string }): { ok: boolean; report: string } {
  return result.ok ? { ok: true, report: result.data ?? 'Done.' } : { ok: false, report: result.error ?? 'The operation failed.' }
}

export const MODE_HINT: Record<string, string> = {
  learning: '🧠 Learning mode - I explain, you configure. Switch to Takeover to let me apply changes.',
  takeover: '⚡ Takeover mode - I can apply configurations directly; big changes still need approval.',
}

export function learningSteps(target: Device, changes: ProposedChange[]): AssistantMessage {
  const lines = changes.map((change) => {
    const p = change.payload as { ip?: string; mask?: string; prefix?: number; gateway?: string }
    if (change.kind === 'interface' && p.ip) return `1. Open ${target.hostname} → interface settings\n2. Set IP ${p.ip} with mask ${p.mask ?? (p.prefix ? prefixToMask(p.prefix) : '255.255.255.0')}\n3. Save`
    if (change.kind === 'gateway' && p.gateway) return `1. Open ${target.hostname} → default gateway\n2. Set it to ${p.gateway} (your router on this subnet)\n3. Save`
    return `1. ${change.summary}`
  })
    return text(`In Learning mode I'll walk you through it instead of changing anything:\n\n${lines.join('\n')}\n\nSwitch to ⚡ Takeover to let me apply changes.`)
}

export function proposeOrApply(plan: LabPlan, intro: string, explicit: boolean): AssistantMessage[] {
  const { mode, setPendingPlan } = useCopilotStore.getState()
  if (mode === 'learning') {
    const target = resolveDevice(plan.changes[0]?.deviceRef)
    if (explicit && target) return [learningSteps(target, plan.changes)]
  }
  if (mode === 'takeover' && explicit && plan.changes.length === 1) {
    const result = executeChange(plan.changes[0])
    return [text(result.report)]
  }
  setPendingPlan(plan)
  return [planMessage(plan, intro)]
}
