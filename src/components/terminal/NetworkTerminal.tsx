import { useState, type KeyboardEvent } from 'react'
import { useNetworkStore } from '@/store/networkStore'
import { useSettingsStore } from '@/store/settingsStore'
import { getRoutingTable } from '@/network/routing'
import { getDeviceById, getDeviceByHostname } from '@/network/devices'

interface TerminalLine {
  id: string
  type: 'input' | 'output' | 'error'
  text: string
}

export function NetworkTerminal() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: '0', type: 'output', text: 'NetForge Network Terminal v0.2' },
    { id: '1', type: 'output', text: 'Type "help" for available commands.' },
  ])
  const [input, setInput] = useState('')
  const simulator = useNetworkStore((s) => s.simulator)
  const devices = useNetworkStore((s) => s.devices)
  const selectedDeviceId = useNetworkStore((s) => s.selectedDeviceId)
  const useSelected = useSettingsStore((s) => s.useSelectedDeviceForTerminal)
  const defaultDevice = useSettingsStore((s) => s.defaultTerminalDevice)
  const setPacketTrace = useNetworkStore((s) => s.setPacketTrace)

  const selectedHost = selectedDeviceId
    ? getDeviceById(devices, selectedDeviceId)?.hostname
    : null
  const contextHost =
    (useSelected ? selectedHost : null) ??
    getDeviceByHostname(devices, defaultDevice)?.hostname ??
    'PC-01'

  function append(type: TerminalLine['type'], text: string) {
    setLines((prev) => [...prev, { id: crypto.randomUUID(), type, text }])
  }

  function runCommand(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return

    append('input', `${contextHost}> ${trimmed}`)
    const [cmd, ...args] = trimmed.split(/\s+/)
    const lower = cmd.toLowerCase()

    switch (lower) {
      case 'help':
        append('output', 'Commands: ping, traceroute, show ip route, show arp, show interfaces, show devices')
        break
      case 'ping': {
        const dest = args[0]
        if (!dest) {
          append('error', 'Usage: ping <destination>')
          break
        }
        const result = simulator.ping(contextHost, dest)
        setPacketTrace({ id: crypto.randomUUID(), path: result.hops, success: result.success })
        if (result.success) {
          append('output', `Reply from ${result.destination}: time=${result.latencyMs}ms`)
          append('output', `Path: ${result.hops.join(' -> ')}`)
        } else {
          append('error', `Ping failed: ${result.failureReason}`)
          if (result.hops.length) append('output', `Path: ${result.hops.join(' -> ')}`)
        }
        break
      }
      case 'traceroute': {
        const dest = args[0]
        if (!dest) {
          append('error', 'Usage: traceroute <destination>')
          break
        }
        const hops = simulator.traceRoute(contextHost, dest)
        setPacketTrace({
          id: crypto.randomUUID(),
          path: hops.filter((hop) => hop.status === 'forwarded').map((hop) => hop.device),
          success: hops.every((hop) => hop.status === 'forwarded'),
        })
        hops.forEach((hop) => {
          if (hop.status === 'failed') {
            append('error', `${hop.hop}  ${hop.device}  * ${hop.failureReason ?? 'FAILED'}`)
          } else {
            append('output', `${hop.hop}  ${hop.device}  ${hop.ip ?? ''}`)
          }
        })
        break
      }
      case 'show': {
        if (args[0] === 'devices') {
          devices.forEach((d) => {
            const ip = d.interfaces.find((i) => i.ipAddress)?.ipAddress ?? 'n/a'
            append('output', `${d.hostname.padEnd(8)} ${d.type.padEnd(8)} ${ip}`)
          })
          break
        }
        const device = getDeviceById(devices, selectedDeviceId ?? '') ?? devices[0]
        if (!device) {
          append('error', 'No device in context')
          break
        }
        if (args.join(' ') === 'ip route') {
          getRoutingTable(device).forEach((route) => {
            append(
              'output',
              `${route.destination} ${route.mask} ${route.nextHop ? `via ${route.nextHop}` : 'connected'} ${route.interfaceName}`,
            )
          })
          break
        }
        if (args.join(' ') === 'arp') {
          simulator.getARPTable(device.hostname).forEach((entry) => {
            append('output', `${entry.ipAddress} ${entry.macAddress} ${entry.interfaceName}`)
          })
          break
        }
        if (args[0] === 'interfaces' || args.join(' ') === 'ip interface') {
          device.interfaces.forEach((iface) => {
            append(
              'output',
              `${iface.name} ${iface.status} ${iface.ipAddress ?? 'unassigned'} ${iface.subnetMask ?? ''}`,
            )
          })
          break
        }
        append('error', `Unknown show command: ${args.join(' ')}`)
        break
      }
      default:
        append('error', `Unknown command: ${cmd}`)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      runCommand(input)
      setInput('')
    }
  }

  return (
    <div className="flex h-full flex-col font-data text-[11px]">
      <div className="panel-header flex items-center justify-between">
        <span>Terminal</span>
        <span className="badge badge-cyan text-[9px] normal-case tracking-normal">ctx: {contextHost}</span>
      </div>
      <div className="flex-1 overflow-auto bg-[var(--bg-inset)] p-2">
        {lines.map((line) => (
          <div
            key={line.id}
            className={
              line.type === 'error'
                ? 'status-down'
                : line.type === 'input'
                  ? 'text-[var(--accent-link)]'
                  : 'text-[var(--text-secondary)]'
            }
          >
            {line.text}
          </div>
        ))}
      </div>
      <div className="flex border-t border-[var(--border)] bg-[var(--bg-inset)]">
        <span className="px-2 py-1.5 text-[var(--accent-link)]">{contextHost}&gt;</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          className="flex-1 bg-transparent py-1.5 pr-2 text-[var(--text-primary)] outline-none"
          spellCheck={false}
          autoComplete="off"
          aria-label="Terminal command input"
        />
      </div>
    </div>
  )
}
