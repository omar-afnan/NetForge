import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { Check, ChevronLeft, MousePointerClick } from 'lucide-react'
import { useDeviceLabStore } from '@/store/deviceLabStore'
import type { DeviceKind } from '@/store/deviceLabStore'
import { COURSES } from '@/devicelab/lessons'
import type { Hotspot } from '@/devicelab/explorerData'

/** Hotspot anchor positions, as percentages of the explorer stage box. */
interface HotspotPos {
  x: number
  y: number
}

const HOTSPOT_POSITIONS: Record<DeviceKind, Record<string, HotspotPos>> = {
  pc: {
    nic: { x: 33, y: 48 },
    'ethernet-port': { x: 33, y: 60 },
    'mac-address': { x: 26, y: 79 },
    gateway: { x: 86, y: 19 },
  },
  router: {
    'wan-interface': { x: 87, y: 55 },
    'lan-interface': { x: 13, y: 55 },
    'routing-table': { x: 50, y: 57 },
    'console-port': { x: 35, y: 67 },
  },
  switch: {
    'switch-ports': { x: 45, y: 59 },
    'port-leds': { x: 45, y: 48 },
    'management-interface': { x: 83, y: 43 },
    vlan: { x: 44, y: 26 },
  },
  server: {
    'network-interfaces': { x: 23, y: 42 },
    'ip-config': { x: 41, y: 45 },
    'dns-service': { x: 35, y: 77 },
    'dhcp-service': { x: 66, y: 77 },
  },
}

const DEVICE_INFO: Record<DeviceKind, { name: string; tagline: string }> = {
  pc: { name: 'Client PC', tagline: 'An end device - where users actually work.' },
  router: { name: 'Router', tagline: 'Forwards packets between different networks.' },
  switch: { name: 'Switch', tagline: 'Connects devices inside one local network.' },
  server: { name: 'Server', tagline: 'Provides services to the rest of the network.' },
}

// ---- Device SVG models (inline, light/clean, CSS-variable colours only) ----

function PcVisual(): ReactElement {
  return (
    <svg viewBox="0 0 480 300" aria-hidden="true">
      <line x1="30" y1="252" x2="450" y2="252" stroke="var(--border)" strokeWidth="2" />
      <rect x="92" y="112" width="68" height="140" rx="4" fill="var(--bg-elevated)" stroke="var(--border-bright)" strokeWidth="1.5" />
      <circle cx="126" cy="132" r="5" fill="none" stroke="var(--status-up)" strokeWidth="1.5" />
      <rect x="104" y="150" width="44" height="6" rx="2" fill="var(--bg-inset)" stroke="var(--border)" />
      <rect x="104" y="164" width="44" height="6" rx="2" fill="var(--bg-inset)" stroke="var(--border)" />
      <text x="126" y="240" textAnchor="middle" fontSize="11" fill="var(--text-dim)">PC-01</text>
      <rect x="152" y="140" width="14" height="20" fill="var(--bg-inset)" stroke="var(--accent-link)" strokeWidth="1.5" />
      <line x1="155" y1="145" x2="163" y2="145" stroke="var(--border-bright)" />
      <line x1="155" y1="150" x2="163" y2="150" stroke="var(--border-bright)" />
      <line x1="155" y1="155" x2="163" y2="155" stroke="var(--border-bright)" />
      <rect x="216" y="84" width="176" height="112" rx="6" fill="var(--bg-elevated)" stroke="var(--border-bright)" strokeWidth="1.5" />
      <rect x="228" y="96" width="152" height="88" rx="2" fill="var(--bg-inset)" stroke="var(--border)" />
      <rect x="284" y="196" width="40" height="14" fill="var(--bg-elevated)" stroke="var(--border-bright)" />
      <rect x="264" y="210" width="80" height="8" rx="3" fill="var(--bg-elevated)" stroke="var(--border-bright)" />
      <path d="M 304 96 C 340 62 356 58 384 58" fill="none" stroke="var(--accent-link)" strokeWidth="1.5" strokeDasharray="4 4" />
      <rect x="386" y="44" width="52" height="28" rx="5" fill="var(--bg-elevated)" stroke="var(--accent-link)" strokeWidth="1.5" />
      <text x="412" y="62" textAnchor="middle" fontSize="10" fill="var(--text-secondary)">GW</text>
    </svg>
  )
}


function RouterVisual(): ReactElement {
  return (
    <svg viewBox="0 0 480 300" aria-hidden="true">
      <rect x="150" y="150" width="180" height="52" rx="6" fill="var(--bg-elevated)" stroke="var(--border-bright)" strokeWidth="1.5" />
      <rect x="162" y="160" width="80" height="32" rx="3" fill="var(--bg-inset)" stroke="var(--border)" />
      <text x="202" y="180" textAnchor="middle" fontSize="11" fill="var(--text-dim)">R1</text>
      <circle cx="242" cy="166" r="3" fill="var(--status-up)" />
      <circle cx="252" cy="166" r="3" fill="var(--status-up)" />
      <circle cx="262" cy="166" r="3" fill="var(--status-dim)" />
      <rect x="278" y="162" width="14" height="28" fill="var(--bg-inset)" stroke="var(--accent-link)" strokeWidth="1.5" />
      <rect x="296" y="162" width="14" height="28" fill="var(--bg-inset)" stroke="var(--accent-link)" strokeWidth="1.5" />
      <rect x="156" y="176" width="14" height="18" fill="var(--bg-inset)" stroke="var(--border-bright)" />
      <rect x="158" y="182" width="10" height="4" fill="var(--text-dim)" />
      <rect x="160" y="176" width="10" height="18" fill="var(--bg-inset)" stroke="var(--border-bright)" />
      <rect x="162" y="182" width="10" height="4" fill="var(--text-dim)" />
      <rect x="164" y="176" width="10" height="18" fill="var(--bg-inset)" stroke="var(--border-bright)" />
      <rect x="166" y="182" width="10" height="4" fill="var(--text-dim)" />
      <path d="M 285 150 C 285 120 320 110 400 110" fill="none" stroke="var(--accent-link)" strokeWidth="1.5" strokeDasharray="4 4" />
      <path d="M 303 150 C 303 120 340 108 430 108" fill="none" stroke="var(--accent-link)" strokeWidth="1.5" strokeDasharray="4 4" />
      <rect x="180" y="202" width="20" height="8" rx="2" fill="var(--bg-inset)" stroke="var(--border-bright)" />
      <text x="165" y="220" fontSize="9" fill="var(--text-dim)">console</text>
      <text x="392" y="120" fontSize="10" fill="var(--text-secondary)">WAN</text>
      <text x="158" y="140" fontSize="10" fill="var(--text-secondary)">LAN</text>
    </svg>
  )
}


function SwitchVisual(): ReactElement {
  return (
    <svg viewBox="0 0 480 300" aria-hidden="true">
      <rect x="110" y="120" width="260" height="78" rx="6" fill="var(--bg-elevated)" stroke="var(--border-bright)" strokeWidth="1.5" />
      <rect x="122" y="132" width="80" height="26" rx="3" fill="var(--bg-inset)" stroke="var(--border)" />
      <text x="162" y="149" textAnchor="middle" fontSize="11" fill="var(--text-dim)">SW1</text>
      <rect x="222" y="132" width="42" height="26" rx="3" fill="var(--bg-inset)" stroke="var(--accent-link)" strokeWidth="1.5" />
      <text x="243" y="149" textAnchor="middle" fontSize="9" fill="var(--text-secondary)">mgmt</text>
      <rect x="122" y="168" width="118" height="20" fill="var(--bg-inset)" stroke="var(--border)" />
      {Array.from({ length: 8 }).map((_, i) => (
        <g key={i}>
          <rect x={134 + i * 14} y="172" width="4" height="12" fill="var(--bg-elevated)" stroke="var(--border-bright)" />
          <circle cx={136 + i * 14} cy="176" r="1.5" fill={i < 3 ? 'var(--status-up)' : 'var(--status-dim)'} />
        </g>
      ))}
      <rect x="244" y="168" width="114" height="20" fill="var(--bg-inset)" stroke="var(--border)" />
      {Array.from({ length: 10 }).map((_, i) => (
        <circle key={i} cx={256 + i * 11} cy="178" r="3" fill={i < 4 ? 'var(--status-up)' : 'var(--status-dim)'} />
      ))}
      <text x="240" y="216" textAnchor="middle" fontSize="10" fill="var(--text-dim)">24-port managed switch</text>
      <path d="M 240 120 C 240 92 240 90 240 70" fill="none" stroke="var(--accent-link)" strokeWidth="1.5" strokeDasharray="4 4" />
      <rect x="214" y="48" width="52" height="28" rx="5" fill="var(--bg-elevated)" stroke="var(--accent-link)" strokeWidth="1.5" />
      <text x="240" y="66" textAnchor="middle" fontSize="10" fill="var(--text-secondary)">LAN</text>
    </svg>
  )
}

function ServerVisual(): ReactElement {
  return (
    <svg viewBox="0 0 480 300" aria-hidden="true">
      <rect x="150" y="70" width="180" height="176" rx="4" fill="var(--bg-elevated)" stroke="var(--border-bright)" strokeWidth="1.5" />
      <rect x="150" y="84" width="18" height="8" fill="var(--bg-inset)" stroke="var(--accent-link)" strokeWidth="1.5" />
      <rect x="150" y="98" width="18" height="8" fill="var(--bg-inset)" stroke="var(--accent-link)" strokeWidth="1.5" />
      <rect x="176" y="82" width="140" height="30" rx="3" fill="var(--bg-inset)" stroke="var(--border)" />
      <text x="184" y="96" fontSize="9" fill="var(--text-secondary)">10.0.0.10</text>
      <text x="184" y="108" fontSize="8" fill="var(--text-dim)">/24  GW 10.0.0.1</text>
      <circle cx="204" cy="130" r="4" fill="var(--status-up)" />
      <text x="214" y="134" fontSize="9" fill="var(--text-secondary)">DNS</text>
      <circle cx="286" cy="130" r="4" fill="var(--status-up)" />
      <text x="296" y="134" fontSize="9" fill="var(--text-secondary)">DHCP</text>
      <rect x="176" y="150" width="140" height="12" rx="2" fill="var(--bg-inset)" stroke="var(--border)" />
      <rect x="176" y="170" width="140" height="12" rx="2" fill="var(--bg-inset)" stroke="var(--border)" />
      <rect x="176" y="190" width="140" height="12" rx="2" fill="var(--bg-inset)" stroke="var(--border)" />
      <rect x="176" y="210" width="140" height="12" rx="2" fill="var(--bg-inset)" stroke="var(--border)" />
      <text x="240" y="244" textAnchor="middle" fontSize="10" fill="var(--text-dim)">SERVER-01</text>
    </svg>
  )
}


function DeviceVisual({ kind }: { kind: DeviceKind }): ReactElement {
  switch (kind) {
    case 'pc':
      return <PcVisual />
    case 'router':
      return <RouterVisual />
    case 'switch':
      return <SwitchVisual />
    case 'server':
      return <ServerVisual />
  }
}

interface DeviceExplorerProps {
  kind: DeviceKind
  hotspots: Hotspot[]
  firstLessonId: string
  onStart: (lessonId: string) => void
  onBack: () => void
}

export function DeviceExplorer({ kind, hotspots, firstLessonId, onStart, onBack }: DeviceExplorerProps): ReactElement {
  const infos = DEVICE_INFO[kind]
  const [activeId, setActiveId] = useState<string | null>(null)
  const [visited, setVisited] = useState<Set<string>>(new Set())
  const positions = HOTSPOT_POSITIONS[kind] ?? {}
  const markExplored = useDeviceLabStore((s) => s.markExplored)

  useEffect(() => {
    markExplored(kind)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  const active = hotspots.find((h) => h.id === activeId) ?? null
  const allDone = visited.size >= hotspots.length
  const exploredCount = visited.size

  const reveal = (id: string) => {
    setActiveId(id)
    setVisited((prev) => new Set(prev).add(id))
  }

  const nextHotspot = (): Hotspot | null => {
    const nextUnvisited = hotspots.find((h) => !visited.has(h.id))
    if (nextUnvisited) return nextUnvisited
    if (hotspots.length > 0) return hotspots[0]
    return null
  }

  const course = COURSES.filter((c) => c.kind === kind)[0]

  return (
    <div className="explorer-root">
      <div className="explorer-header">
        <button type="button" onClick={onBack} className="explorer-back" aria-label="Back to lessons">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="explorer-header-tag">{course?.title ?? infos.name}</span>
        <span className="explorer-progress">
          {exploredCount}/{hotspots.length} explored
        </span>
      </div>

      <div className="explorer-body">
        <div className="explorer-stage">
          <div className="explorer-stage-top">
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-[var(--accent-link)]" />
              <span className="text-[12px] font-semibold text-[var(--text-primary)]">Explore {infos.name}</span>
            </div>
            <span className="text-[11px] text-[var(--text-dim)]">Tap a highlighted area to learn what it does.</span>
          </div>

          <div className="explorer-canvas">
            {allDone ? (
              <div className="explorer-done">
                <div className="explorer-done-badge">
                  <Check className="h-7 w-7 text-[var(--status-up)]" />
                </div>
                <div className="text-[14px] font-bold text-[var(--text-primary)]">You explored the {infos.name}</div>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  Great! You now know the key parts and what they do. Time to put that knowledge to work.
                </p>
              </div>
            ) : (
              <DeviceVisual kind={kind} />
            )}

            {hotspots.map((h) => {
              const pos = positions[h.id]
              if (!pos) return null
              const isActive = activeId === h.id
              const isVisited = visited.has(h.id)
              return (
                <button
                  key={h.id}
                  type="button"
                  aria-label={h.name}
                  onClick={() => reveal(h.id)}
                  className={`explorer-hotspot ${isActive ? 'explorer-hotspot-active' : ''} ${isVisited ? 'explorer-hotspot-visited' : ''}`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  <span>{isVisited ? 'OK' : '?'}</span>
                </button>
              )
            })}
          </div>

          <div className="explorer-stage-footer">
            {allDone ? (
              <span className="text-[12px] text-[var(--status-up)]">All areas explored</span>
            ) : (
              <button type="button" onClick={() => { const n = nextHotspot(); if (n) reveal(n.id) }} className="explorer-next">
                {exploredCount === 0 ? 'Start exploring' : 'Explore next'}
              </button>
            )}
          </div>
        </div>

        <aside className="explorer-panel">
          {active ? (
            <>
              <div className="explorer-name">{active.name}</div>
              <p className="explorer-summary">{active.summary}</p>
              <div className="explorer-section">
                <div className="explorer-section-label">What it is</div>
                <p className="explorer-text">{active.explanation}</p>
              </div>
              <div className="explorer-section">
                <div className="explorer-section-label">Why it matters</div>
                <p className="explorer-text">{active.networkingRelevance}</p>
              </div>
            </>
          ) : (
            <div className="explorer-empty">
              <div className="explorer-empty-title">Tap a hotspot to begin</div>
              <p className="explorer-empty-text">
                Select the highlighted areas on the {infos.name.toLowerCase()} to reveal what each part does and
                why a network engineer cares about it.
              </p>
            </div>
          )}
        </aside>
      </div>

      <div className="explorer-cta">
        <button type="button" onClick={onBack} className="explorer-cta-secondary">
          Back to lessons
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onStart(firstLessonId)} className="explorer-cta-skip">
            Skip Introduction
          </button>
          <button
            type="button"
            onClick={() => onStart(firstLessonId)}
            className="explorer-cta-primary"
            disabled={!allDone}
          >
            {allDone ? 'Start Configuration' : `Explore ${hotspots.length - exploredCount} more`}
          </button>
        </div>
      </div>
    </div>
  )
}

