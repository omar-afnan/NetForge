import type { AssistantMessage, ProposedChange } from '@/assistant/types'
import type { ParsedCommand } from './parse'
import { resolveDevice, getSelectedDevice, summarizeDevice } from './context'
import { text, buildPlan, proposeOrApply } from './engine.core'
import { maskToPrefix } from '@/network/ip'

export function handleConfigure(cmd: ParsedCommand): AssistantMessage[] {
  const target = resolveDevice(cmd.deviceRef) ?? getSelectedDevice() ?? undefined
  if (!target) return [text('Which device? Select one on the canvas or name it, e.g. "configure PC-01 with 10.1.10.50/24".')]
  const changes: ProposedChange[] = []
  if (cmd.ip) {
    const label = cmd.interfaceRef ? `${cmd.interfaceRef} ` : ''
    changes.push({ id: crypto.randomUUID(), kind: 'interface', deviceRef: target.hostname, summary: `Configure ${target.hostname} ${label}-> ${cmd.ip}/${cmd.prefix ?? (cmd.mask ? maskToPrefix(cmd.mask) : 24)}`, payload: { interfaceRef: cmd.interfaceRef, ip: cmd.ip, mask: cmd.mask, prefix: cmd.prefix } })
  }
  if (cmd.gateway) changes.push({ id: crypto.randomUUID(), kind: 'gateway', deviceRef: target.hostname, summary: `Set ${target.hostname} default gateway -> ${cmd.gateway}`, payload: { gateway: cmd.gateway } })
  if (changes.length === 0) return [text(`Happy to configure ${target.hostname}. Give me details, e.g.:\n"Configure ${target.hostname} with 10.1.10.50/24 gateway 10.1.10.1"\n\n${summarizeDevice(target)}`)]
  const plan = buildPlan(`Configure ${target.hostname}`, ['Requested directly by the student.'], changes)
  return proposeOrApply(plan, `Here is what I will change on ${target.hostname}:`, true)
}

export function handleGateway(cmd: ParsedCommand): AssistantMessage[] {
  if (!cmd.gateway) return [text('Which gateway? e.g. "set the gateway of PC-01 to 10.1.10.1".')]
  const device = resolveDevice(cmd.deviceRef) ?? getSelectedDevice() ?? undefined
  if (!device) return [text('Which device? Select one on the canvas or name it.')]
  const plan = buildPlan(`Set gateway on ${device.hostname}`, ['Requested directly by the student.'], [{ id: crypto.randomUUID(), kind: 'gateway', deviceRef: device.hostname, summary: `Set ${device.hostname} default gateway -> ${cmd.gateway}`, payload: { gateway: cmd.gateway } }])
  return proposeOrApply(plan, 'Gateway change:', true)
}

export function handleRoute(cmd: ParsedCommand, remove: boolean): AssistantMessage[] {
  const device = resolveDevice(cmd.deviceRef) ?? getSelectedDevice() ?? undefined
  if (!device) return [text('Which router? e.g. "add a static route on R-02 to 10.1.20.0/24 via 10.1.0.6".')]
  if (!cmd.route) return [text(`Tell me network + next hop, e.g. "${remove ? 'remove' : 'add'} the route on ${device.hostname} to 10.1.20.0/24 via 10.1.0.6".`)]
  const { destination, mask, prefix, nextHop } = cmd.route
  const bits = prefix ?? maskToPrefix(mask ?? '255.255.255.0')
  if (remove) {
    const plan = buildPlan(`Remove route on ${device.hostname}`, ['Requested directly by the student.'], [{ id: crypto.randomUUID(), kind: 'route-remove', deviceRef: device.hostname, summary: `Remove route ${destination}/${bits} from ${device.hostname}`, payload: { destination, mask, prefix } }])
    return proposeOrApply(plan, 'Route removal:', true)
  }
  if (!nextHop) return [text('Via which next-hop IP? e.g. "... via 10.1.0.6".')]
  const plan = buildPlan(`Add route on ${device.hostname}`, ['Requested directly by the student.'], [{ id: crypto.randomUUID(), kind: 'route-add', deviceRef: device.hostname, summary: `Add route on ${device.hostname}: ${destination}/${bits} via ${nextHop}`, payload: { destination, mask, prefix, nextHop } }])
  return proposeOrApply(plan, 'Static route change:', true)
}

export function handleInterfaceStatus(cmd: ParsedCommand): AssistantMessage[] {
  const device = resolveDevice(cmd.deviceRef) ?? getSelectedDevice() ?? undefined
  if (!device || !cmd.interfaceRef || !cmd.status) return [text('Tell me which interface + state, e.g. "shut down Gi0/1 on R-01".')]
  const verb = cmd.status === 'up' ? 'Enable' : 'Shut down'
  const plan = buildPlan(`${verb} ${device.hostname} ${cmd.interfaceRef}`, ['Requested directly by the student.'], [{ id: crypto.randomUUID(), kind: 'interface-status', deviceRef: device.hostname, summary: `${verb} ${device.hostname} ${cmd.interfaceRef}`, payload: { interfaceRef: cmd.interfaceRef, status: cmd.status } }])
  return proposeOrApply(plan, 'Interface change:', true)
}
