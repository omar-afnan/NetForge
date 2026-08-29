import type { Device, NetworkLink } from '@/network/types'
import type { AssistStep } from '@/store/copilotStore'
import { useCopilotStore } from '@/store/copilotStore'
import { useNetworkStore } from '@/store/networkStore'
import { getPrimaryInterface } from '@/network/devices'
import { NetworkSimulator } from '@/network/simulator'

export interface LabAssistContext {
  labId: string
  devices: Device[]
  links: NetworkLink[]
  simulator: NetworkSimulator
  pushMessage: (message: { id: string; role: 'assistant'; kind: 'text' | 'plan'; text: string; planId?: string }) => void
  setStatus: (status: 'idle' | 'thinking' | 'working') => void
  setHighlight: (deviceId: string | null) => void
  setPacketTrace: (trace: { id: string; path: string[]; success: boolean } | null) => void
  selectDevice: (deviceId: string | null) => void
  completeLab: (aiAssisted: boolean) => void
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export async function runLabAssist(labId: string) {
  const store = useCopilotStore.getState()
  const net = useNetworkStore.getState()

  const steps: AssistStep[] = [
    { id: 'inspect', label: 'Inspecting affected device', detail: 'Checking host configuration', status: 'pending' },
    { id: 'local-ping', label: 'Testing local connectivity', detail: 'Verifying LAN communication', status: 'pending' },
    { id: 'remote-ping', label: 'Testing external connectivity', detail: 'Checking gateway forwarding', status: 'pending' },
    { id: 'diagnose', label: 'Comparing configuration', detail: 'Identifying the fault', status: 'pending' },
    { id: 'propose', label: 'Proposing fix', detail: 'Waiting for approval', status: 'pending' },
    { id: 'apply', label: 'Applying correction', detail: 'Updating configuration', status: 'pending' },
    { id: 'verify', label: 'Verifying connectivity', detail: 'Confirming the fix', status: 'pending' },
  ]

  store.startLabAssist(labId, steps)
  store.setStatus('thinking')

  const ctx: LabAssistContext = {
    labId,
    devices: net.devices,
    links: net.links,
    simulator: net.simulator,
    pushMessage: (msg) => store.pushMessage(msg),
    setStatus: (status) => store.setStatus(status),
    setHighlight: (deviceId) => store.setLabAssistHighlight(deviceId),
    setPacketTrace: (trace) => net.setPacketTrace(trace),
    selectDevice: (deviceId) => net.selectDevice(deviceId),
    completeLab: (aiAssisted) => net.completeLab(labId, aiAssisted),
  }

  try {
    await investigateWrongGateway(ctx)
  } catch (error) {
    store.pushMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      kind: 'text',
      text: `[ERROR] Something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}`,
    })
  } finally {
    store.setStatus('idle')
    store.setLabAssistBusy(false)
    store.stopLabAssist()
    net.setHighlightedDevice(null)
  }
}

async function investigateWrongGateway(ctx: LabAssistContext) {
  const { devices, links, simulator } = ctx

  const affected = devices.find((d) => d.id === 'pc-02') ?? devices.find((d) => d.type === 'pc') ?? null
  if (!affected) {
    ctx.pushMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      kind: 'text',
      text: 'I could not find a workstation to investigate.',
    })
    return
  }

  const gateway = affected.defaultGateway
  const primaryIface = getPrimaryInterface(affected)
  const pcIp = primaryIface?.ipAddress ?? 'n/a'
  const pcMask = primaryIface?.subnetMask ?? 'n/a'

  // Step 1: Inspect device
  ctx.setHighlight(affected.id)
  ctx.selectDevice(affected.id)
  ctx.pushMessage({
    id: crypto.randomUUID(),
    role: 'assistant',
    kind: 'text',
    text: `[INSPECT] Inspecting ${affected.hostname}\n\nWhy?\nThe problem affects only one workstation, so we will start by checking its configuration.\n\nFindings:\n- IPv4: ${pcIp}\n- Subnet Mask: ${pcMask}\n- Default Gateway: ${gateway ?? 'not set'}`,
  })
  await delay(1800)
  ctx.setStatus('thinking')
  useCopilotStore.getState().advanceLabAssist()
  await delay(600)

  // Step 2: Test local connectivity
  ctx.setStatus('working')
  const localTarget = devices.find((d) => d.id !== affected.id && d.type === 'pc' && getPrimaryInterface(d)?.ipAddress)
  if (localTarget) {
    const localIp = getPrimaryInterface(localTarget)?.ipAddress
    const localResult = simulator.forward(affected.hostname, localIp ?? localTarget.hostname)
    ctx.setPacketTrace({ id: crypto.randomUUID(), path: localResult.path, success: localResult.success })

    ctx.pushMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      kind: 'text',
      text: `[TEST] Testing local connectivity: ${affected.hostname} -> ${localTarget.hostname}\n\nWhy?\nIf local communication works, the switch, cabling, and local subnet are less likely to be the problem.\n\nResult: ${localResult.success ? '[PASS] Reply received' : '[FAIL] ' + (localResult.failureReason ?? 'Failed')}`,
    })
    await delay(2200)
    ctx.setPacketTrace(null)
    useCopilotStore.getState().advanceLabAssist()
  }

  // Step 3: Test external connectivity
  const remoteTarget = devices.find((d) => d.type === 'server' && getPrimaryInterface(d)?.ipAddress)
  if (remoteTarget) {
    const remoteIp = getPrimaryInterface(remoteTarget)?.ipAddress
    const remoteResult = simulator.forward(affected.hostname, remoteIp ?? remoteTarget.hostname)
    ctx.setPacketTrace({ id: crypto.randomUUID(), path: remoteResult.path, success: remoteResult.success })

    ctx.pushMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      kind: 'text',
      text: `[TEST] Testing external connectivity: ${affected.hostname} -> ${remoteTarget.hostname}\n\nWhy?\nThis tells us whether the workstation can send traffic beyond its local subnet.\n\nResult: ${remoteResult.success ? '[PASS] Reply received' : '[FAIL] ' + (remoteResult.failureReason ?? 'Failed')}`,
    })
    await delay(2200)
    ctx.setPacketTrace(null)
    useCopilotStore.getState().advanceLabAssist()
  }

  // Step 4: Diagnose
  ctx.setStatus('thinking')
  await delay(800)

  const expectedGateway = findExpectedGateway(affected, devices, links)
  const hasWrongGateway = gateway && expectedGateway && gateway !== expectedGateway

  ctx.pushMessage({
    id: crypto.randomUUID(),
    role: 'assistant',
    kind: 'text',
    text: `[DIAGNOSE] Comparing gateway configuration\n\nCurrent gateway: ${gateway ?? 'not set'}\nExpected gateway: ${expectedGateway ?? 'unknown'}\n\n${
      hasWrongGateway
        ? `I found the problem. ${affected.hostname} has a default gateway (${gateway}) that does not point to the router on this LAN.\n\nThe workstation can communicate with devices on its own subnet because those devices are directly reachable. When ${affected.hostname} needs to reach another network, it sends the packet to its default gateway. Because the configured gateway is incorrect, traffic leaving the subnet cannot be forwarded.`
        : 'The configuration appears consistent. The issue may be elsewhere.'
    }`,
  })
  await delay(1500)
  useCopilotStore.getState().advanceLabAssist()

  if (!hasWrongGateway) {
    ctx.setHighlight(null)
    return
  }

  // Step 5: Propose fix
  const changes = [
    {
      id: crypto.randomUUID(),
      kind: 'gateway' as const,
      deviceRef: affected.hostname,
      summary: `Set ${affected.hostname} default gateway -> ${expectedGateway}`,
      payload: { gateway: expectedGateway },
    },
  ]

  const plan = {
    id: crypto.randomUUID(),
    title: `Fix default gateway on ${affected.hostname}`,
    rationale: [`Default gateway is misconfigured on ${affected.hostname}`],
    changes,
  }

  useCopilotStore.getState().setPendingPlan(plan)
  ctx.pushMessage({
    id: crypto.randomUUID(),
    role: 'assistant',
    kind: 'plan',
    text: `[PROPOSAL] Fix default gateway\n\nCurrent: ${gateway}\nCorrect: ${expectedGateway}\n\nApply this change?`,
    planId: plan.id,
  })

  // Wait for user approval
  await waitForPlanApproval()
  ctx.setStatus('working')
  useCopilotStore.getState().advanceLabAssist()

  // Step 6: Apply fix
  ctx.pushMessage({
    id: crypto.randomUUID(),
    role: 'assistant',
    kind: 'text',
    text: `[APPLY] Updating ${affected.hostname} default gateway:\n\n${gateway}\n\t\t↓\n${expectedGateway}`,
  })
  await delay(1200)

  useNetworkStore.getState().updateDevice(affected.id, { defaultGateway: expectedGateway })
  await delay(600)
  useCopilotStore.getState().advanceLabAssist()

  // Refresh local state after mutation
  const updatedDevices = useNetworkStore.getState().devices
  const updatedAffected = updatedDevices.find((d) => d.id === affected.id)
  if (updatedAffected) {
    ctx.pushMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      kind: 'text',
      text: `[DONE] ${updatedAffected.hostname} default gateway updated to ${updatedAffected.defaultGateway}.`,
    })
  }

  await delay(1000)

  // Step 7: Verify
  if (remoteTarget && updatedAffected) {
    const verifyResult = simulator.forward(updatedAffected.hostname, getPrimaryInterface(remoteTarget)?.ipAddress ?? remoteTarget.hostname)
    ctx.setPacketTrace({ id: crypto.randomUUID(), path: verifyResult.path, success: verifyResult.success })

    ctx.pushMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      kind: 'text',
      text: `[VERIFY] Testing connectivity after fix: ${updatedAffected.hostname} -> ${remoteTarget.hostname}\n\nResult: ${verifyResult.success ? '[PASS] Reply received' : '[FAIL] ' + (verifyResult.failureReason ?? 'Failed')}`,
    })
    await delay(2200)
    ctx.setPacketTrace(null)
    useCopilotStore.getState().advanceLabAssist()
  }

  ctx.setHighlight(null)
  ctx.completeLab(true)

  ctx.pushMessage({
    id: crypto.randomUUID(),
    role: 'assistant',
    kind: 'text',
    text: `[LAB COMPLETE] ✓ The Wrong Gateway\n\nThe workstation can now reach networks outside its local subnet. The default gateway was the problem.\n\nSkills practiced:\n- Default Gateway\n- Local vs Remote Networks\n- Connectivity Troubleshooting\n- Host Configuration`,
  })
}

function findExpectedGateway(device: Device, devices: Device[], links: NetworkLink[]): string | undefined {
  const primary = getPrimaryInterface(device)
  if (!primary?.ipAddress || !primary.subnetMask) return undefined
  const primaryIp = primary.ipAddress
  const primaryMask = primary.subnetMask

  const neighbors = links
    .filter((l) => l.sourceDeviceId === device.id || l.targetDeviceId === device.id)
    .map((l) => (l.sourceDeviceId === device.id ? l.targetDeviceId : l.sourceDeviceId))

  for (const neighborId of neighbors) {
    const neighbor = devices.find((d) => d.id === neighborId)
    if (!neighbor) continue
    if (neighbor.type === 'router' || neighbor.type === 'switch') {
      const routerIface = neighbor.interfaces.find(
        (iface) => iface.ipAddress && iface.subnetMask && isSameSubnet(iface.ipAddress, primaryIp, primaryMask) && iface.status === 'up',
      )
      if (routerIface) return routerIface.ipAddress
    }
  }

  return undefined
}

function isSameSubnet(ip: string, gateway: string, mask: string): boolean {
  const ipParts = ip.split('.').map(Number)
  const gwParts = gateway.split('.').map(Number)
  const maskParts = mask.split('.').map(Number)
  if (ipParts.some(Number.isNaN) || gwParts.some(Number.isNaN) || maskParts.some(Number.isNaN)) return false
  for (let i = 0; i < 4; i++) {
    if ((ipParts[i] & maskParts[i]) !== (gwParts[i] & maskParts[i])) return false
  }
  return true
}

function waitForPlanApproval(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      const store = useCopilotStore.getState()
      if (store.status === 'idle' && !store.labAssist.enabled) {
        resolve()
        return
      }
      window.setTimeout(check, 500)
    }
    window.setTimeout(check, 500)
  })
}
