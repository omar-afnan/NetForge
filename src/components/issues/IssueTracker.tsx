import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { useNetworkStore } from '@/store/networkStore'
import { useCopilotStore } from '@/store/copilotStore'
import { useUIStore } from '@/store/uiStore'
import { ping as runPingTool, runConnectivityMatrix } from '@/assistant/tools'
import { scanLab } from '@/assistant/diagnose'
import { executeChange } from '@/assistant/engine.core'
import { runLabAssist } from '@/assistant/labAssist'
import type { ProposedChange } from '@/assistant/types'
import type { Device } from '@/network/types'
import {
  buildFailurePoint,
  buildVerificationTests,
  evaluateHypothesis,
  gatherEvidence,
  progressiveHint,
  loadHistory,
  saveResolution,
  HYPOTHESIS_CATEGORIES,
  type Evidence,
  type IssueCategory,
  type ResolutionRecord,
} from './issueWorkspace'

interface ToolResultView {
  id: string
  title: string
  ok: boolean
  lines: string[]
}

type WorkspaceStatus = 'investigating' | 'fixing' | 'resolved'

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  children: React.ReactNode
}) {
  return (
    <section className="panel border">
      <div className="panel-header flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[var(--accent-link)]" strokeWidth={1.75} />
        <span>{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </section>
  )
}

export function IssueTracker() {
  const lab = useNetworkStore((s) => s.lab)
  const devices = useNetworkStore((s) => s.devices)
  const links = useNetworkStore((s) => s.links)
  const issues = useNetworkStore((s) => s.issues)
  const simulator = useNetworkStore((s) => s.simulator)
  const revalidate = useNetworkStore((s) => s.revalidate)
  const setPacketTrace = useNetworkStore((s) => s.setPacketTrace)
  const setHighlightedDevice = useNetworkStore((s) => s.setHighlightedDevice)
  const completeLab = useNetworkStore((s) => s.completeLab)
  const completedLabs = useNetworkStore((s) => s.completedLabs)
  const setActiveView = useUIStore((s) => s.setActiveView)
  const copilot = useCopilotStore()

  // The baseline "Competition Lab" and an empty workspace have no fault to
  // solve, so the whole ticket framing (Active Issue / Resolved / verification)
  // does not apply to them.
  const isSandbox = lab.id === 'starter' || lab.id === 'blank' || devices.length === 0
  // The ONLY trustworthy "this lab is done" signal: a persisted completion
  // record (written by verification or the AI takeover). Passing pings alone
  // never flip the ticket to Resolved.
  const labComplete = !!completedLabs[lab.id]?.completed

  const [status, setStatus] = useState<WorkspaceStatus>('investigating')
  const [results, setResults] = useState<ToolResultView[]>([])
  const [busyTool, setBusyTool] = useState<string | null>(null)
  const [hypothesis, setHypothesis] = useState<IssueCategory | null>(null)
  const [hypothesisFeedback, setHypothesisFeedback] = useState<string | null>(null)
  const [hintLevel, setHintLevel] = useState(0)
  const [inlineAi, setInlineAi] = useState<string | null>(null)
  const [verification, setVerification] = useState<{ label: string; ok: boolean; detail: string }[] | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [history, setHistory] = useState<ResolutionRecord[]>([])
  const [hypothesisSubmitted, setHypothesisSubmitted] = useState(false)
  const [scanEpoch, setScanEpoch] = useState(0)
  const [scanning, setScanning] = useState(false)
  const investigationCount = useRef(0)
  const strongestAssist = useRef<'None' | 'Hint' | 'Explain' | 'Full Investigation'>('None')
  const autoVerifiedRef = useRef(false)

  // Reset the workspace whenever the active lab changes.
  useEffect(() => {
    setStatus('investigating')
    setResults([])
    setHypothesis(null)
    setHypothesisFeedback(null)
    setHintLevel(0)
    setInlineAi(null)
    setVerification(null)
    setAttempts(0)
    setHypothesisSubmitted(false)
    setHistory(loadHistory(lab.id))
    investigationCount.current = 0
    strongestAssist.current = 'None'
    autoVerifiedRef.current = false
  }, [lab.id])

  /* ── Live analysis, all derived from real state ─────────────── */

  const matrix = useMemo(() => runConnectivityMatrix(), [devices, links, scanEpoch])
  const failingTest = useMemo(() => matrix.find((t) => !t.success), [matrix])

  const primaryDevice: Device | undefined = useMemo(() => {
    const host = failingTest?.source ?? devices.find((d) => d.id === issues[0]?.deviceId)?.hostname
    return devices.find((d) => d.hostname === host)
  }, [failingTest, devices, issues])

  const failurePoint = useMemo(
    () => buildFailurePoint(issues, devices, (s, d) => simulator.traceRoute(s, d), failingTest),
    [issues, devices, simulator, failingTest],
  )

  const evidence: Evidence | null = useMemo(
    () => (primaryDevice ? gatherEvidence(primaryDevice, devices, links) : null),
    [primaryDevice, devices, links],
  )

  // A suggested fix only appears once the student has investigated - run at
  // least two tools or committed to a hypothesis. Always derived live via
  // the assistant's own diagnose engine (no answer keys).
  const suggestedFix = useMemo<ProposedChange | null>(() => {
    if (investigationCount.current < 2 && !hypothesisSubmitted) return null
    return scanLab().plan[0] ?? null
  }, [devices, links, hypothesisSubmitted])

  const allPass = matrix.length > 0 && matrix.every((t) => t.success)

  // Resolved is driven by the persisted completion record, never by pings alone
  // (the baseline lab passes every ping yet has nothing to solve).
  useEffect(() => {
    if (labComplete) setStatus('resolved')
  }, [labComplete])

  // A student who fixes the fault straight from the terminal (never clicking
  // "Apply Fix") still earns the completion: when every connectivity test
  // passes on a real, not-yet-completed lab, run the real verification once -
  // that is what writes the completion record and updates the Lab Library.
  useEffect(() => {
    if (isSandbox || labComplete || !allPass) return
    if (autoVerifiedRef.current || busyTool) return
    autoVerifiedRef.current = true
    void runVerification()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPass, isSandbox, labComplete, busyTool])

  /* ── Actions - every one drives the REAL simulator/stores ───── */

  const noteInvestigation = () => {
    investigationCount.current += 1
  }

  const pushResult = (title: string, ok: boolean, lines: string[]) =>
    setResults((prev) => [{ id: crypto.randomUUID(), title, ok, lines }, ...prev].slice(0, 12))

  const pingN = async (label: string, destination: string, times = 4) => {
    if (!primaryDevice || busyTool) return
    setBusyTool(label)
    noteInvestigation()
    try {
      let okCount = 0
      let lastDetail = ''
      let lastHops: string[] = []
      for (let i = 0; i < times; i += 1) {
        const result = runPingTool(primaryDevice.hostname, destination)
        if (result.ok && result.data) {
          if (result.data.success) okCount += 1
          lastDetail = result.data.detail
          lastHops = result.data.hops ?? []
        } else {
          lastDetail = result.error ?? 'Ping failed.'
        }
        // Animate the real path on the topology via the existing packetTrace.
        setPacketTrace({ id: crypto.randomUUID(), path: lastHops, success: okCount > i })
        await new Promise((r) => window.setTimeout(r, 260))
      }
      setPacketTrace({ id: crypto.randomUUID(), path: lastHops, success: okCount === times })
      setHighlightedDevice(primaryDevice.id)
      window.setTimeout(() => setHighlightedDevice(null), 1600)
      pushResult(
        `PING ${destination} - ${okCount}/${times} replies`,
        okCount === times,
        [
          okCount === times ? `✓ Reply received (${lastDetail})` : `✗ Request timed out - ${lastDetail}`,
          lastHops.length ? `Path: ${lastHops.join(' → ')}` : '',
          `Sent: ${times}   Received: ${okCount}   Lost: ${times - okCount}`,
        ].filter(Boolean),
      )
    } finally {
      setBusyTool(null)
    }
  }

  const runTraceroute = async (destination: string) => {
    if (!primaryDevice || busyTool) return
    setBusyTool('traceroute')
    noteInvestigation()
    try {
      const hops = simulator.traceRoute(primaryDevice.hostname, destination)
      const ok = hops.every((h) => h.status === 'forwarded')
      setPacketTrace({
        id: crypto.randomUUID(),
        path: hops.filter((h) => h.status === 'forwarded').map((h) => h.device),
        success: ok,
      })
      useNetworkStore.getState().logPacket({
        source: primaryDevice.hostname,
        destination,
        protocol: 'ICMP',
        path: hops.filter((h) => h.status === 'forwarded').map((h) => h.device),
        status: ok ? 'success' : 'failed',
        failureReason: ok ? undefined : hops.find((h) => h.status === 'failed')?.failureReason,
      })
      pushResult(
        `TRACEROUTE ${destination}`,
        ok,
        hops.map((h) =>
          `${h.status === 'forwarded' ? '✓' : '✗'} ${h.hop}  ${h.device}  ${h.ip ?? ''} ${h.failureReason ?? ''}`.trimEnd(),
        ),
      )
    } finally {
      setBusyTool(null)
    }
  }

  const showReport = (label: string, lines: string[]) => {
    noteInvestigation()
    pushResult(label, true, lines.length ? lines : ['(empty)'])
  }

  const remoteDestination = failingTest?.destination.match(/\(([\d.]+)\)/)?.[1] ?? failingTest?.destination

  // Re-scan: re-run the audit AND the live connectivity analysis, with visible
  // feedback. (revalidate() alone only refreshes the internal issues array.)
  const handleRescan = () => {
    if (scanning) return
    setScanning(true)
    revalidate()
    setScanEpoch((epoch) => epoch + 1)
    window.setTimeout(() => {
      const fresh = runConnectivityMatrix()
      const passing = fresh.filter((t) => t.success).length
      const failingRows = fresh.filter((t) => !t.success)
      pushResult(
        `NETWORK RE-SCAN - ${passing}/${fresh.length} connectivity tests passing`,
        failingRows.length === 0,
        failingRows.length
          ? failingRows.slice(0, 8).map((t) => `✗ ${t.source} → ${t.destination} - ${t.detail}`)
          : ['✓ All endpoint pairs reachable'],
      )
      setScanning(false)
    }, 450)
  }

  const submitHypothesis = () => {
    if (!hypothesis) return
    setHypothesisSubmitted(true)
    noteInvestigation()
    const feedback = evaluateHypothesis(hypothesis, evidence)
    setHypothesisFeedback(
      feedback.text + (feedback.suggestedTest ? `\n\nNow prove it - try: ${feedback.suggestedTest}` : ''),
    )
  }

  const giveHint = () => {
    const level = Math.min(hintLevel, 2)
    const hintText = progressiveHint(evidence, level)
    setHintLevel(level + 1)
    setInlineAi(`💡 Hint: ${hintText}`)
    copilot.pushMessage({ id: crypto.randomUUID(), role: 'assistant', kind: 'text', text: `💡 Hint: ${hintText}` })
    if (strongestAssist.current === 'None') strongestAssist.current = 'Hint'
  }

  const explainEvidence = () => {
    if (!evidence) return
    const explanation = [
      `🔎 What the evidence shows for ${evidence.hostname}:`,
      ...evidence.rows.map((r) => `• ${r.label}: ${r.value}`),
      '',
      ...evidence.notes.map((n) => `• ${n.text}`),
      '',
      'Why this matters: a host only uses its default gateway for traffic that leaves its own subnet. Devices on the same subnet never touch it.',
    ].join('\n')
    setInlineAi(explanation)
    copilot.pushMessage({ id: crypto.randomUUID(), role: 'assistant', kind: 'text', text: explanation })
    if (strongestAssist.current !== 'Full Investigation') strongestAssist.current = 'Explain'
  }

  const aiInvestigate = () => {
    strongestAssist.current = 'Full Investigation'
    copilot.pushMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      kind: 'text',
      text: '🤖 Taking over the investigation - watch the live topology overlay. You can keep typing questions here while I work.',
    })
    void runLabAssist(lab.id).catch((err) => {
      console.warn('Lab assist run rejected:', err)
    })
  }

  /* ── Fix + verification - the real lab tests decide ─────────── */

  const applyFix = () => {
    if (!suggestedFix) return
    const outcome = executeChange(suggestedFix)
    copilot.addAction({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      message: `Applied: ${suggestedFix.summary}`,
      type: outcome.ok ? 'success' : 'warning',
    })
    setInlineAi(`${outcome.ok ? '✅' : '❌'} ${suggestedFix.summary}\n${outcome.report}`)
    setStatus('fixing')
    setAttempts((a) => a + 1)
    void runVerification()
  }

  const runVerification = async () => {
    if (busyTool) return
    setBusyTool('verify')
    try {
      const tests = buildVerificationTests(primaryDevice, devices)
      const rows: { label: string; ok: boolean; detail: string }[] = []
      for (const test of tests) {
        const result = simulator.ping(test.source, test.destinationIp)
        useNetworkStore.getState().logPacket({
          source: test.source,
          destination: test.destinationIp,
          protocol: 'ICMP',
          path: result.hops,
          status: result.success ? 'success' : 'failed',
          failureReason: result.success ? undefined : result.failureReason,
        })
        setPacketTrace({ id: crypto.randomUUID(), path: result.hops, success: result.success })
        rows.push({
          label: test.label,
          ok: result.success,
          detail: result.success ? `${result.latencyMs}ms` : (result.failureReason ?? 'failed'),
        })
        await new Promise((r) => window.setTimeout(r, 320))
      }
      setPacketTrace(null)
      setVerification(rows)

      // The REAL lab verification: every endpoint pair must pass.
      const finalMatrix = runConnectivityMatrix()
      const passing = finalMatrix.filter((t) => t.success).length
      const resolved = finalMatrix.length > 0 && passing === finalMatrix.length
      if (resolved) {
        completeLab(lab.id, strongestAssist.current === 'Full Investigation')
        const record: ResolutionRecord = {
          labId: lab.id,
          issueTitle: lab.title,
          solvedBy: strongestAssist.current === 'Full Investigation' ? 'AI' : 'Student',
          attempts: attempts + 1,
          aiAssistance: strongestAssist.current,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
        saveResolution(record)
        setHistory(loadHistory(lab.id))
        setStatus('resolved')
      }
      pushResult(
        `VERIFICATION - ${passing}/${finalMatrix.length} connectivity tests passing`,
        resolved,
        finalMatrix.map((t) => `${t.success ? '✓' : '✗'} ${t.source} → ${t.destination}`),
      )
    } finally {
      setBusyTool(null)
    }
  }

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span>Issue Workspace</span>
        <button
          type="button"
          disabled={scanning}
          className="flex items-center gap-1.5 border border-[var(--border)] px-2 py-0.5 font-data text-[10px] font-normal normal-case tracking-normal text-[var(--text-secondary)] transition-colors hover:border-[var(--border-bright)] hover:text-[var(--text-primary)] disabled:opacity-60"
          onClick={handleRescan}
        >
          <RefreshCw className={`h-3 w-3 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning…' : 'Re-scan'}
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-3">
        {/* 1 · STATUS HEADER — honest three-state ticket, or a sandbox notice */}
        {isSandbox ? (
          <div className="panel border p-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-[var(--accent-link)]" strokeWidth={1.75} />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
                {devices.length === 0 ? 'Empty Workspace' : 'Baseline Sandbox'}
              </span>
              <span className={`ml-auto badge difficulty-${lab.difficulty}`}>{lab.difficulty}</span>
              <span className="badge badge-cyan">No Faults</span>
            </div>
            <div className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
              {devices.length === 0
                ? 'No topology loaded. Open the Lab Library and load a lab to start troubleshooting — this workspace only tracks a fault once one exists.'
                : 'This is the baseline competition topology — every device, link and route is healthy by design. There is no fault to investigate here, so it never counts toward lab completion.'}
            </div>
            {devices.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-data text-[10px] text-[var(--text-dim)]">
                <span className="text-[var(--status-up)]">
                  {matrix.filter((t) => t.success).length}/{matrix.length}
                </span>
                <span>endpoint pairs reachable</span>
                <span>·</span>
                <span>0 injected faults</span>
                <span>·</span>
                <span>{lab.title}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="panel border p-4">
            <div className="flex items-center gap-2">
              {status === 'resolved' ? (
                <CheckCircle2 className="h-4 w-4 text-[var(--status-up)]" strokeWidth={1.75} />
              ) : status === 'fixing' ? (
                <Wrench className="h-4 w-4 text-[var(--accent-link)]" strokeWidth={1.75} />
              ) : (
                <AlertTriangle className="h-4 w-4 text-[var(--status-warn)]" strokeWidth={1.75} />
              )}
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
                {status === 'resolved' ? 'Resolved Issue' : 'Active Issue'}
              </span>
              <span className={`ml-auto badge difficulty-${lab.difficulty}`}>{lab.difficulty}</span>
              <span className={`badge ${status === 'resolved' ? 'badge-completed' : 'badge-cyan'}`}>
                {status === 'resolved' ? 'Resolved' : status === 'fixing' ? 'Fixing' : 'Investigating'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-data text-[13px] font-semibold text-[var(--text-primary)]">
                {primaryDevice?.hostname ?? failingTest?.source ?? '—'}
              </span>
              <span className="text-[12px] text-[var(--text-secondary)]">
                {status === 'resolved'
                  ? 'Fault repaired — every connectivity test passes.'
                  : failingTest
                    ? `Cannot reach ${failingTest.destination}`
                    : (issues[0]?.description ?? 'Running audit…')}
              </span>
            </div>
            {/* honest progress meter — no need to hunt through the re-scan log */}
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden bg-[var(--border)]">
                <div
                  className={`h-full transition-all ${allPass ? 'bg-[var(--status-up)]' : 'bg-[var(--status-warn)]'}`}
                  style={{
                    width: `${matrix.length ? (matrix.filter((t) => t.success).length / matrix.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="font-data text-[10px] text-[var(--text-dim)]">
                {matrix.filter((t) => t.success).length}/{matrix.length} paths
              </span>
            </div>
            <div className="mt-1 font-data text-[10px] text-[var(--text-dim)]">
              {lab.title} · {issues.length} audit finding{issues.length === 1 ? '' : 's'} · detected:{' '}
              {failingTest ? 'connectivity failure' : (issues[0]?.detectedBy ?? 'config-audit')}
            </div>
            {allPass && !labComplete && status !== 'resolved' && (
              <div className="mt-3 flex items-center gap-2 border border-[var(--status-up)] bg-[rgba(22,163,74,0.08)] px-3 py-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--status-up)]" strokeWidth={1.75} />
                <span className="text-[11px] text-[var(--text-secondary)]">
                  Connectivity looks restored — verifying to confirm and close the ticket…
                </span>
              </div>
            )}
          </div>
        )}
        {/* 2 · FAILURE POINT + 3 · EVIDENCE */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Section title="Failure Point" icon={Search}>
            {failurePoint ? (
              <div>
                <div className="font-data text-[11px]">
                  {failurePoint.hops.map((hop, index) => {
                    const isFailed = failurePoint.failedHopIndex === index
                    const isLast = index === failurePoint.hops.length - 1
                    return (
                      <div key={`${hop.device}-${index}`}>
                        <div
                          className={`flex items-center gap-2 ${isFailed ? 'status-down' : 'text-[var(--text-secondary)]'}`}
                        >
                          <span>{isFailed ? '❌' : '✓'}</span>
                          <span>{hop.device}</span>
                          {hop.ip && <span className="text-[var(--text-dim)]">({hop.ip})</span>}
                        </div>
                        {!isLast && <div className="ml-3 h-3 border-l border-[var(--border)]" />}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 text-[11px] text-[var(--text-secondary)]">
                  {failurePoint.failedHopIndex !== null
                    ? `Traffic stops at ${failurePoint.hops[failurePoint.failedHopIndex].device}${failurePoint.reason ? ` - ${failurePoint.reason}` : ''}`
                    : 'No failure on this path right now.'}
                </div>
                <button
                  type="button"
                  className="mt-2 border border-[var(--border-bright)] px-2 py-1 font-data text-[10px] text-[var(--accent-link)] transition-colors hover:bg-[rgba(46,200,240,0.1)]"
                  onClick={() => {
                    setPacketTrace({
                      id: crypto.randomUUID(),
                      path: failurePoint.hops.filter((h) => h.status === 'forwarded').map((h) => h.device),
                      success: failurePoint.failedHopIndex === null,
                    })
                    setActiveView('topology')
                  }}
                >
                  Show on topology →
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-[var(--text-dim)]">No failing path detected.</div>
            )}
          </Section>

          <Section title="Evidence" icon={Search}>
            {evidence ? (
              <div>
                <div className="mb-1 font-data text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                  {evidence.hostname}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {evidence.rows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-baseline justify-between gap-2 border-b border-[var(--border)] py-1"
                    >
                      <span className="text-[10px] text-[var(--text-dim)]">{row.label}</span>
                      <span className="font-data text-[11px] text-[var(--text-primary)]">{row.value}</span>
                    </div>
                  ))}
                </div>
                {evidence.notes.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {evidence.notes.map((note, i) => (
                      <li
                        key={i}
                        className={`border-l-2 px-2 py-1 text-[11px] leading-relaxed ${
                          note.tone === 'warn'
                            ? 'border-[var(--status-warn)] bg-[rgba(240,180,41,0.06)] text-[var(--text-secondary)]'
                            : 'border-[var(--border)] text-[var(--text-dim)]'
                        }`}
                      >
                        {note.tone === 'warn' ? '⚠ ' : '• '}
                        {note.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-[var(--text-dim)]">No device in scope.</div>
            )}
          </Section>
        </div>
        {/* 4 · INVESTIGATION TOOLS */}
        <Section title="Investigation Tools" icon={Wrench}>
          <div className="flex flex-wrap gap-2">
            {[
              {
                id: 'ping-gw',
                label: 'Ping Gateway',
                disabled: !primaryDevice?.defaultGateway,
                run: () => pingN('ping-gw', primaryDevice!.defaultGateway!),
              },
              {
                id: 'ping-remote',
                label: 'Ping Remote Host',
                disabled: !remoteDestination,
                run: () => pingN('ping-remote', remoteDestination!),
              },
              {
                id: 'traceroute',
                label: 'Traceroute',
                disabled: !remoteDestination,
                run: () => runTraceroute(remoteDestination!),
              },
              {
                id: 'arp',
                label: 'Show ARP',
                disabled: !primaryDevice,
                run: () =>
                  showReport(
                    `ARP table - ${primaryDevice!.hostname}`,
                    simulator.getARPTable(primaryDevice!.hostname).map((e) => `${e.ipAddress} → ${e.macAddress} (${e.interfaceName})`),
                  ),
              },
              {
                id: 'routes',
                label: 'Show Routing Table',
                disabled: !primaryDevice,
                run: () =>
                  showReport(
                    `Routing table - ${primaryDevice!.hostname}`,
                    simulator.getRoutingTable(primaryDevice!.hostname).map((r) => `${r.destination}/${r.mask} ${r.nextHop ? `via ${r.nextHop}` : 'connected'} [${r.status}]`),
                  ),
              },
              {
                id: 'ifaces',
                label: 'Show Interfaces',
                disabled: !primaryDevice,
                run: () =>
                  showReport(
                    `Interfaces - ${primaryDevice!.hostname}`,
                    primaryDevice!.interfaces.map((i) => `${i.name}  ${i.status}  ${i.ipAddress ?? 'unassigned'} ${i.subnetMask ?? ''}`),
                  ),
              },
            ].map((tool) => (
              <button
                key={tool.id}
                type="button"
                disabled={tool.disabled || busyTool !== null}
                onClick={tool.run}
                className={`border px-2.5 py-1.5 font-data text-[11px] transition-colors ${
                  tool.disabled
                    ? 'cursor-not-allowed border-[var(--border)] text-[var(--text-dim)]'
                    : busyTool === tool.id
                      ? 'border-[var(--accent-link)] text-[var(--accent-link)]'
                      : 'border-[var(--border-bright)] text-[var(--text-primary)] hover:border-[var(--accent-link)] hover:text-[var(--accent-link)]'
                }`}
              >
                {busyTool === tool.id ? 'Running…' : tool.label}
              </button>
            ))}
          </div>

          {results.length > 0 && (
            <div className="mt-3 space-y-2">
              {results.map((result) => (
                <div key={result.id} className="border border-[var(--border)] bg-[var(--bg-inset)] p-2">
                  <div className={`font-data text-[10px] font-semibold ${result.ok ? 'text-[var(--status-up)]' : 'status-down'}`}>
                    {result.title}
                  </div>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-data text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {result.lines.join('\n')}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 6 · HYPOTHESIS */}
        <Section title="What do you think is wrong?" icon={Search}>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {HYPOTHESIS_CATEGORIES.map((category) => (
              <label key={category.id} className="flex cursor-pointer items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                <input
                  type="radio"
                  name="hypothesis"
                  className="accent-[var(--accent-link)]"
                  checked={hypothesis === category.id}
                  onChange={() => setHypothesis(category.id)}
                />
                {category.label}
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={!hypothesis}
            onClick={submitHypothesis}
            className={`mt-3 border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              hypothesis
                ? 'border-[var(--accent-link)] text-[var(--accent-link)] hover:bg-[rgba(46,200,240,0.1)]'
                : 'cursor-not-allowed border-[var(--border)] text-[var(--text-dim)]'
            }`}
          >
            Submit Hypothesis
          </button>
          {hypothesisFeedback && (
            <div className="mt-2 border-l-2 border-[var(--accent-amber)] bg-[rgba(240,180,41,0.06)] px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap text-[var(--text-secondary)]">
              {hypothesisFeedback}
            </div>
          )}
        </Section>

        {/* 7 · AI ASSISTANCE - progressive, non-blocking */}
        <Section title="NetForge AI" icon={Sparkles}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="border border-[var(--border-bright)] px-2.5 py-1.5 text-[11px] transition-colors hover:border-[var(--accent-link)]"
              onClick={giveHint}
            >
              💡 Give Me a Hint{hintLevel > 0 ? ` (${Math.min(hintLevel + 1, 3)}/3)` : ''}
            </button>
            <button
              type="button"
              className="border border-[var(--border-bright)] px-2.5 py-1.5 text-[11px] transition-colors hover:border-[var(--accent-link)]"
              onClick={explainEvidence}
            >
              🔎 Explain the Evidence
            </button>
            <button
              type="button"
              className="border border-[var(--border-bright)] px-2.5 py-1.5 text-[11px] transition-colors hover:border-[var(--accent-link)]"
              onClick={() =>
                copilot.pushMessage({
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  kind: 'text',
                  text: 'Ask me anything in the chat on the right - I can see the live topology and can run diagnostics for you.',
                })
              }
            >
              🤖 Ask AI (chat →)
            </button>
            <button
              type="button"
              disabled={copilot.labAssist.busy}
              className="border border-[var(--border-bright)] px-2.5 py-1.5 text-[11px] transition-colors hover:border-[var(--accent-amber)] disabled:cursor-not-allowed disabled:text-[var(--text-dim)]"
              onClick={aiInvestigate}
            >
              ⚡ Let AI Investigate
            </button>
          </div>
          {inlineAi && (
            <div className="mt-2 border border-[var(--border)] bg-[var(--bg-inset)] p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-[var(--text-secondary)]">
              {inlineAi}
            </div>
          )}
        </Section>

        {/* 9 · SUGGESTED FIX - only after real investigation */}
        {suggestedFix && (
          <Section title="Suggested Fix" icon={Wrench}>
            <div className="font-data text-[12px] text-[var(--text-primary)]">{suggestedFix.summary}</div>
            {suggestedFix.detail && (
              <div className="mt-1 text-[11px] text-[var(--text-secondary)]">{suggestedFix.detail}</div>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="border border-[var(--accent-link)] px-3 py-1.5 font-data text-[11px] text-[var(--accent-link)] transition-colors hover:bg-[rgba(46,200,240,0.1)]"
                onClick={applyFix}
              >
                Apply Fix
              </button>
              <button
                type="button"
                className="border border-[var(--border-bright)] px-3 py-1.5 font-data text-[11px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                onClick={() => setActiveView('topology')}
              >
                I'll Fix It Myself (topology / terminal)
              </button>
            </div>
          </Section>
        )}

        {/* 10 · VERIFICATION - real simulator tests only */}
        {(verification || status !== 'investigating') && (
          <Section title="Verification" icon={ShieldCheck}>
            {verification ? (
              <div>
                <div className="font-data text-[11px]">
                  {verification.map((row) => (
                    <div
                      key={row.label}
                      className={`flex items-center gap-2 py-0.5 ${row.ok ? 'text-[var(--status-up)]' : 'status-down'}`}
                    >
                      <span>{row.ok ? '✓' : '✗'}</span>
                      <span>{row.label}</span>
                      <span className="ml-auto text-[var(--text-dim)]">{row.detail}</span>
                    </div>
                  ))}
                </div>
                {status === 'resolved' ? (
                  <div className="mt-2 flex items-center gap-2 border border-[var(--status-up)] bg-[rgba(22,163,74,0.08)] px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-[var(--status-up)]" strokeWidth={1.75} />
                    <span className="text-[12px] font-semibold text-[var(--status-up)]">
                      ALL TESTS PASSED - 🎉 ISSUE RESOLVED
                    </span>
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-[var(--text-secondary)]">
                    Not all tests pass yet - keep investigating.
                  </div>
                )}
                <button
                  type="button"
                  disabled={busyTool !== null}
                  className="mt-2 border border-[var(--border-bright)] px-2.5 py-1 font-data text-[10px] text-[var(--accent-link)] transition-colors hover:bg-[rgba(46,200,240,0.1)] disabled:text-[var(--text-dim)]"
                  onClick={() => void runVerification()}
                >
                  {busyTool === 'verify' ? 'Verifying…' : 'Run Verification'}
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-[var(--text-dim)]">
                Apply a fix (or fix it yourself), then run verification - the lab only counts as resolved when
                every real connectivity test passes.
              </div>
            )}
          </Section>
        )}

        {/* 11 · RESOLUTION HISTORY */}
        {history.length > 0 && (
          <Section title="Resolution History" icon={CheckCircle2}>
            <ul className="space-y-1.5">
              {history
                .slice()
                .reverse()
                .map((record, index) => (
                  <li
                    key={index}
                    className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-[var(--border)] pb-1.5 text-[11px]"
                  >
                    <span className="text-[var(--status-up)]">✓</span>
                    <span className="font-data text-[var(--text-primary)]">{record.issueTitle}</span>
                    <span className="text-[var(--text-dim)]">Solved by: {record.solvedBy}</span>
                    <span className="text-[var(--text-dim)]">Attempts: {record.attempts}</span>
                    <span className="text-[var(--text-dim)]">AI: {record.aiAssistance}</span>
                    <span className="ml-auto font-data text-[var(--text-dim)]">{record.time}</span>
                  </li>
                ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  )
}