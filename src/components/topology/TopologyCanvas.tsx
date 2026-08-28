import { useEffect, useMemo, useRef, useState } from 'react'
import type { Device } from '@/network/types'
import { cableMeta } from '@/network/cables'
import { useNetworkStore } from '@/store/networkStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useUIStore } from '@/store/uiStore'

const NODE_W = 88
const NODE_H = 52
const CANVAS_W = 1240
const CANVAS_H = 560

const typeColors: Record<string, string> = {
  pc: '#2ec8f0',
  switch: '#8b9cb3',
  router: '#f0b429',
  server: '#34d399',
}

const typeLabels: Record<string, string> = {
  pc: 'PC',
  switch: 'SW',
  router: 'RTR',
  server: 'SRV',
}

/** Seconds for one traffic-flow loop per cable kind — fiber is fastest, serial crawls. */
const FLOW_SECONDS: Record<string, number> = {
  copper: 2.2,
  fiber: 1.1,
  serial: 7.5,
  wireless: 4.5,
}

function flowSeconds(kind?: string): number {
  return FLOW_SECONDS[kind ?? 'copper'] ?? 2.2
}

/** Stable pseudo-random direction so neighbouring cables don't all flow the same way. */
function flowsForward(id: string): boolean {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 997
  return hash % 2 === 0
}

interface Point {
  x: number
  y: number
}

function nodeCenter(device: Device): Point {
  return {
    x: (device.position?.x ?? 0) + NODE_W / 2,
    y: (device.position?.y ?? 0) + NODE_H / 2,
  }
}

function connectionPoints(source: Device, target: Device) {
  const s = nodeCenter(source)
  const t = nodeCenter(target)
  const dx = t.x - s.x
  const dy = t.y - s.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx >= 0) {
      return { x1: s.x + NODE_W / 2, y1: s.y, x2: t.x - NODE_W / 2, y2: t.y }
    }
    return { x1: s.x - NODE_W / 2, y1: s.y, x2: t.x + NODE_W / 2, y2: t.y }
  }

  if (dy >= 0) {
    return { x1: s.x, y1: s.y + NODE_H / 2, x2: t.x, y2: t.y - NODE_H / 2 }
  }
  return { x1: s.x, y1: s.y - NODE_H / 2, x2: t.x, y2: t.y + NODE_H / 2 }
}

function clampPosition(position: Point): Point {
  return {
    x: Math.min(Math.max(position.x, 0), CANVAS_W - NODE_W),
    y: Math.min(Math.max(position.y, 0), CANVAS_H - NODE_H),
  }
}

/** Point along a polyline at normalized distance t (0..1). */
function pointAlongPath(points: Point[], t: number): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]

  const lengths: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    const length = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    lengths.push(length)
    total += length
  }

  let remaining = Math.min(Math.max(t, 0), 1) * total
  for (let i = 0; i < lengths.length; i += 1) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const ratio = lengths[i] === 0 ? 0 : remaining / lengths[i]
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * ratio,
        y: points[i].y + (points[i + 1].y - points[i].y) * ratio,
      }
    }
    remaining -= lengths[i]
  }
  return points[points.length - 1]
}

export function TopologyCanvas() {
  const devices = useNetworkStore((s) => s.devices)
  const links = useNetworkStore((s) => s.links)
  const selectedDeviceId = useNetworkStore((s) => s.selectedDeviceId)
  const selectedLinkId = useNetworkStore((s) => s.selectedLinkId)
  const packetTrace = useNetworkStore((s) => s.packetTrace)
  const selectDevice = useNetworkStore((s) => s.selectDevice)
  const selectLink = useNetworkStore((s) => s.selectLink)
  const addDevice = useNetworkStore((s) => s.addDevice)
  const moveDevice = useNetworkStore((s) => s.moveDevice)
  const removeDevice = useNetworkStore((s) => s.removeDevice)
  const addLink = useNetworkStore((s) => s.addLink)
  const removeLink = useNetworkStore((s) => s.removeLink)
  const clearPacketTrace = useNetworkStore((s) => s.clearPacketTrace)

  const topologyTool = useUIStore((s) => s.topologyTool)
  const setTopologyTool = useUIStore((s) => s.setTopologyTool)
  const pendingDeviceType = useUIStore((s) => s.pendingDeviceType)
  const wireKind = useUIStore((s) => s.wireKind)
  const setTopologyNotice = useUIStore((s) => s.setTopologyNotice)

  const showGrid = useSettingsStore((s) => s.showTopologyGrid)
  const showLinkPulse = useSettingsStore((s) => s.showLinkPulse)
  const glowEffects = useSettingsStore((s) => s.glowEffects)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<{ deviceId: string; offset: Point; moved: boolean } | null>(null)
  const [wireSourceId, setWireSourceId] = useState<string | null>(null)
  const [wireCursor, setWireCursor] = useState<Point | null>(null)
  const [tracePos, setTracePos] = useState<Point | null>(null)

  const deviceMap = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices])
  const hostnameMap = useMemo(() => new Map(devices.map((d) => [d.hostname, d])), [devices])

  const wireSource = wireSourceId ? deviceMap.get(wireSourceId) : undefined

  function toSvgPoint(event: React.PointerEvent): Point {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse())
    return { x: point.x, y: point.y }
  }

  // Escape exits the current tool; Delete removes the selected node or cable.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return

      if (event.key === 'Escape') {
        setTopologyTool('select')
        setWireSourceId(null)
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const state = useNetworkStore.getState()
        if (state.selectedDeviceId) {
          event.preventDefault()
          const device = state.devices.find((d) => d.id === state.selectedDeviceId)
          state.removeDevice(state.selectedDeviceId)
          setTopologyNotice(device ? `${device.hostname} removed` : null)
        } else if (state.selectedLinkId) {
          state.removeLink(state.selectedLinkId)
          setTopologyNotice('Cable removed')
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setTopologyTool, setTopologyNotice])

  // Animate a packet dot along the path reported by the simulator.
  useEffect(() => {
    if (!packetTrace) {
      setTracePos(null)
      return
    }

    const points = packetTrace.path
      .map((hostname) => hostnameMap.get(hostname))
      .filter((device): device is Device => Boolean(device?.position))
      .map(nodeCenter)

    if (points.length < 2) {
      clearPacketTrace()
      return
    }

    let raf = 0
    let cleared = false
    const duration = 600 + points.length * 220
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      setTracePos(pointAlongPath(points, t))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else if (!cleared) {
        cleared = true
        window.setTimeout(() => clearPacketTrace(), 450)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cleared = true
      cancelAnimationFrame(raf)
    }
  }, [packetTrace, hostnameMap, clearPacketTrace])

  function handleNodePointerDown(event: React.PointerEvent, device: Device) {
    event.stopPropagation()

    if (topologyTool === 'wire') {
      if (!wireSourceId) {
        setWireSourceId(device.id)
        setTopologyNotice(`From ${device.hostname} — click a second device`)
      } else if (wireSourceId === device.id) {
        setWireSourceId(null)
      } else {
        const result = addLink(wireSourceId, device.id, wireKind)
        setTopologyNotice(result.message)
        setWireSourceId(null)
      }
      return
    }

    if (topologyTool === 'delete') {
      removeDevice(device.id)
      setTopologyNotice(`${device.hostname} removed`)
      return
    }

    if (topologyTool !== 'select' || !device.position) return

    const point = toSvgPoint(event)
    dragRef.current = {
      deviceId: device.id,
      offset: { x: point.x - device.position.x, y: point.y - device.position.y },
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleNodePointerMove(event: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const point = toSvgPoint(event)
    moveDevice(drag.deviceId, clampPosition({ x: point.x - drag.offset.x, y: point.y - drag.offset.y }))
    drag.moved = true
  }

  function handleNodePointerUp(event: React.PointerEvent) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (!drag.moved) {
      selectDevice(drag.deviceId)
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  function handleBackgroundPointerDown(event: React.PointerEvent) {
    const point = toSvgPoint(event)

    if (topologyTool === 'place') {
      addDevice(pendingDeviceType, clampPosition({ x: point.x - NODE_W / 2, y: point.y - NODE_H / 2 }))
      setTopologyNotice(`${pendingDeviceType.toUpperCase()} placed`)
      return
    }

    if (topologyTool === 'wire') {
      setWireSourceId(null)
      return
    }

    if (topologyTool === 'select') {
      selectDevice(null)
      selectLink(null)
    }
  }

  function handleSvgPointerMove(event: React.PointerEvent) {
    if (topologyTool === 'wire' && wireSourceId) {
      setWireCursor(toSvgPoint(event))
    }
  }

  const cursorClass = topologyTool === 'select' ? 'cursor-default' : 'cursor-crosshair'

  return (
    <div className={`grid-bg relative h-full min-h-[420px] overflow-auto ${showGrid ? 'show-grid' : ''}`}>
      <svg
        ref={svgRef}
        className={`relative h-full min-h-[420px] w-full min-w-[1240px] ${cursorClass}`}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handleSvgPointerMove}
      >
        <defs>
          <filter id="node-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
          </filter>
          <filter id="selected-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#2ec8f0" floodOpacity="0.45" />
          </filter>
        </defs>

        {links.map((link) => {
          const source = deviceMap.get(link.sourceDeviceId)
          const target = deviceMap.get(link.targetDeviceId)
          if (!source?.position || !target?.position) return null
          const up = link.status === 'up'
          const meta = cableMeta(link.kind)
          const selected = link.id === selectedLinkId
          const { x1, y1, x2, y2 } = connectionPoints(source, target)
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2
          const flowStyle = {
            pointerEvents: 'none' as const,
            animationDuration: `${flowSeconds(link.kind)}s`,
            animationDirection: flowsForward(link.id) ? ('normal' as const) : ('reverse' as const),
          }

          return (
            <g key={link.id}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={up ? meta.color : 'rgba(248, 113, 113, 0.75)'}
                strokeWidth={selected ? 3 : up ? 1.75 : 1.25}
                strokeDasharray={up ? meta.dash : '4 4'}
                opacity={selected ? 1 : up ? 0.7 : 1}
              />
              {up && showLinkPulse && (
                <>
                  {glowEffects && (
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={meta.color}
                      strokeWidth={8}
                      strokeDasharray="0.1 30"
                      opacity={selected ? 0.3 : 0.18}
                      className="link-flow"
                      style={flowStyle}
                    />
                  )}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={meta.color}
                    strokeWidth={3}
                    strokeDasharray="0.1 30"
                    opacity={selected ? 1 : 0.9}
                    className="link-flow"
                    style={flowStyle}
                  />
                </>
              )}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="transparent"
                strokeWidth={12}
                style={{ cursor: 'pointer' }}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  if (topologyTool === 'delete') {
                    removeLink(link.id)
                    setTopologyNotice('Cable removed')
                    return
                  }
                  if (topologyTool === 'select') {
                    selectLink(link.id)
                  }
                }}
              />
              {selected && (
                <g>
                  <rect
                    x={mx - 46}
                    y={my - 11}
                    width={92}
                    height={20}
                    fill="var(--bg-elevated)"
                    stroke="var(--border-bright)"
                  />
                  <text
                    x={mx}
                    y={my + 3.5}
                    textAnchor="middle"
                    fill={up ? meta.color : 'var(--status-down)'}
                    fontSize="9"
                    fontFamily="Consolas, monospace"
                  >
                    {up ? `${meta.label.toUpperCase()} · ${link.bandwidthMbps ?? 1000}M` : 'LINK DOWN'}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {wireSource && wireCursor && (
          <line
            x1={nodeCenter(wireSource).x}
            y1={nodeCenter(wireSource).y}
            x2={wireCursor.x}
            y2={wireCursor.y}
            stroke={cableMeta(wireKind).color}
            strokeWidth={1.75}
            strokeDasharray="6 5"
          />
        )}

        {devices.map((device) => {
          if (!device.position) return null
          const selected = device.id === selectedDeviceId
          const primaryIp = device.interfaces.find((i) => i.ipAddress)?.ipAddress
          const color = typeColors[device.type]
          const failed = device.status !== 'healthy'
          const wirePicked = wireSourceId === device.id

          return (
            <g
              key={device.id}
              transform={`translate(${device.position.x}, ${device.position.y})`}
              filter={selected && glowEffects ? 'url(#selected-glow)' : 'url(#node-glow)'}
              style={{ cursor: topologyTool === 'select' ? 'grab' : 'crosshair' }}
              onPointerDown={(event) => handleNodePointerDown(event, device)}
              onPointerMove={handleNodePointerMove}
              onPointerUp={handleNodePointerUp}
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                fill={selected ? '#152030' : '#0e1520'}
                stroke={selected ? '#2ec8f0' : failed ? '#f87171' : '#243040'}
                strokeWidth={selected ? 1.5 : 1}
              />
              <rect x={0} y={0} width={NODE_W} height={3} fill={color} />
              <text x={7} y={17} fill="#e8eef5" fontSize="10" fontFamily="Consolas, monospace" fontWeight="600">
                {device.hostname}
              </text>
              <text x={7} y={30} fill="#9aadc4" fontSize="8" fontFamily="Consolas, monospace">
                {typeLabels[device.type]}
              </text>
              <text x={7} y={43} fill="#5f7389" fontSize="8" fontFamily="Consolas, monospace">
                {primaryIp ?? 'n/a'}
              </text>
              {wirePicked && (
                <rect
                  x={-3}
                  y={-3}
                  width={NODE_W + 6}
                  height={NODE_H + 6}
                  fill="none"
                  stroke={cableMeta(wireKind).color}
                  strokeDasharray="5 4"
                />
              )}
            </g>
          )
        })}

        {tracePos && packetTrace && (
          <g style={{ pointerEvents: 'none' }}>
            <circle
              cx={tracePos.x}
              cy={tracePos.y}
              r={9}
              fill={packetTrace.success ? 'var(--status-up)' : 'var(--status-down)'}
              opacity={0.22}
            />
            <circle
              cx={tracePos.x}
              cy={tracePos.y}
              r={3.5}
              fill={packetTrace.success ? 'var(--status-up)' : 'var(--status-down)'}
            />
          </g>
        )}
      </svg>

      {devices.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12px] text-[var(--text-dim)]">
          Empty canvas — pick a device in the toolbar and click to place it.
        </div>
      )}
    </div>
  )
}
