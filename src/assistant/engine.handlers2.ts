import type { AssistantMessage } from '@/assistant/types'
import type { ParsedCommand } from './parse'
import { resolveDevice, getSelectedDevice, summarizeDevice } from './context'
import { ping, runConnectivityMatrix } from './tools'
import { diagnosePing, scanLab, formatMatrix } from './diagnose'
import { text, buildPlan, planMessage, proposeOrApply } from './engine.core'
import { lookupKnowledge } from './knowledge'
import { useCopilotStore } from '@/store/copilotStore'
import type { Device } from '@/network/types'

export function handlePing(cmd: ParsedCommand): AssistantMessage[] {
  const source = resolveDevice(cmd.deviceRef) ?? getSelectedDevice() ?? undefined
  if (!source) return [text('Ping from which device? e.g. "ping 10.1.20.10 from PC-01".')]
  const ipMatch = /\b(\d{1,3}(?:\.\d{1,3}){3})\b/.exec(cmd.raw)
  const destination = cmd.targetRef ?? ipMatch?.[1]
  if (!destination) return [text(`Ping from ${source.hostname} to which destination? Give a hostname or IP.`)]
  const result = ping(source.hostname, destination)
  if (!result.ok || !result.data) return [text(`[FAIL] ${result.error ?? 'Ping failed.'}`)]
  if (result.data.success) return [text(`[OK] ${result.data.source} -> ${result.data.destination}: success (${result.data.detail}).`)]
  const diagnosis = diagnosePing(source.hostname, result.data.destination)
  const lines = [`[FAIL] ${result.data.source} -> ${result.data.destination} failed.`, '', diagnosis.explanation]
  if (diagnosis.teachingPoint) lines.push('', `Book: ${diagnosis.teachingPoint}`)
  const messages: AssistantMessage[] = [text(lines.join('\n'))]
  if (diagnosis.fixes.length > 0) messages.push(...proposeOrApply(buildPlan('Fix connectivity', [diagnosis.explanation], diagnosis.fixes), 'I can fix this automatically:', false))
  return messages
}

export function handleDiagnose(cmd: ParsedCommand): AssistantMessage[] {
  const source = resolveDevice(cmd.deviceRef)
  if (source && cmd.targetRef) return handlePing({ ...cmd, intent: 'ping' })
  const result = scanLab()
  if (result.problems.length === 0) return [text(`I scanned the lab — every test passes. 🎉\n\n${formatMatrix(result.matrix)}`)]
  const lines = ['I found these issues:', '']
  for (const problem of result.problems.slice(0, 8)) {
    lines.push(`${problem.severity === 'critical' ? '🔴' : problem.severity === 'warning' ? '🟠' : '🔵'} ${problem.summary}`)
    if (problem.detail) lines.push(`   ${problem.detail}`)
  }
    const messages: AssistantMessage[] = [text(lines.join('\n'))]
  if (result.plan.length > 0) {
    const repairPlan = buildPlan('Repair lab', result.problems.map((p) => p.summary), result.plan)
    messages.push(text('The plan below fixes the root causes — nothing applied until you approve.'))
    messages.push(planMessage(repairPlan, 'Proposed repair plan:'))
  } else messages.push(text('These may need manual topology changes I won\'t do without your say-so.'))
  return messages
}

export function handleTests(): AssistantMessage[] {
  const matrix = runConnectivityMatrix()
  if (matrix.length === 0) return [text('No configured endpoints (PCs/servers) to test between yet.')]
  const passing = matrix.filter((t) => t.success).length
  const header = passing === matrix.length ? `All ${matrix.length} tests pass. 🎉` : `${passing}/${matrix.length} tests pass.`
  return [text(`${header}\n\n${formatMatrix(matrix)}`)]
}

export function handleCompleteLab(): AssistantMessage[] {
  const { problems, plan, matrix } = scanLab()
  if (plan.length === 0) return [text(problems.length === 0 ? `All ${matrix.length} tests already pass. 🎉` : `Issues found, none I can safely automate:\n${problems.map((p) => `• ${p.summary}`).join('\n')}`)]
  const labPlan = buildPlan('Complete the lab', problems.slice(0, 6).map((p) => p.summary), plan)
  const intro = [`Found ${labPlan.changes.length} change${labPlan.changes.length === 1 ? '' : 's'} required.`, '', ...labPlan.changes.map((c) => `• ${c.summary}`), '', 'Nothing applied yet — review and approve.']
  useCopilotStore.getState().setPendingPlan(labPlan)
  return [planMessage(labPlan, intro.join('\n'))]
}

export function handleDeviceInfo(cmd: ParsedCommand): AssistantMessage[] {
  const device: Device | undefined = resolveDevice(cmd.deviceRef) ?? getSelectedDevice() ?? undefined
  if (!device) return [text('Which device? Select one on the canvas or ask e.g. "show me R-01".')]
  return [text(summarizeDevice(device))]
}

export function handleConcept(cmd: ParsedCommand): AssistantMessage[] {
  const entry = lookupKnowledge(cmd.concept)
  if (!entry) return [text('I can explain: default gateway · subnetting · CIDR · ARP · MAC · switching · routing · VLANs · TCP/UDP · ports · ping · Ethernet · DHCP')]
  return [text(`Book: ${entry.title}\n\n${entry.body}`)]
}
