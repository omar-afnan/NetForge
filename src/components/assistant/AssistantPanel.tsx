import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Bot,
  Brain,
  Check,
  ChevronDown,
  Paperclip,
  RefreshCw,
  Send,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react'
import { useCopilotStore } from '@/store/copilotStore'
import { useNetworkStore } from '@/store/networkStore'
import { applyPlan, cancelPlan, handleMessage } from '@/assistant/engine'
import { scanLab } from '@/assistant/diagnose'
import type { LabProblem } from '@/assistant/diagnose'
import type { PingTest, ProposedChange } from '@/assistant/types'

const SUGGESTIONS = [
  'Find the problem',
  'Run connectivity tests',
  'Explain default gateways',
]

const STATUS_LABEL = {
  idle: 'Ready',
  thinking: 'Thinking...',
  working: 'Working...',
} as const

interface LabScan {
  problems: LabProblem[]
  plan: ProposedChange[]
  matrix: PingTest[]
}

export function AssistantPanel() {
  const messages = useCopilotStore((s) => s.messages)
  const mode = useCopilotStore((s) => s.mode)
  const status = useCopilotStore((s) => s.status)
  const pendingPlan = useCopilotStore((s) => s.pendingPlan)
  const actions = useCopilotStore((s) => s.actions)
  const setMode = useCopilotStore((s) => s.setMode)
  const clearChat = useCopilotStore((s) => s.clearChat)

  const selectedDeviceId = useNetworkStore((s) => s.selectedDeviceId)
  const devices = useNetworkStore((s) => s.devices)
  const links = useNetworkStore((s) => s.links)
  const selected = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  )

  const [input, setInput] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [diagOpen, setDiagOpen] = useState(true)
  const [scan, setScan] = useState<LabScan | null>(null)
  const [scanning, setScanning] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scanToken = useRef(0)

  // Keep the latest message visible.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, status])

  /**
   * Live diagnostics: re-run the lab scan (pure reads + simulated pings)
   * whenever the topology changes or the assistant finishes working.
   * Deferred slightly so a spinner can paint, and token-guarded so a
   * stale result can never overwrite a newer one.
   */
  const refreshScan = useCallback(() => {
    if (useCopilotStore.getState().status !== 'idle') return
    const token = ++scanToken.current
    setScanning(true)
    window.setTimeout(() => {
      if (token !== scanToken.current) return
      try {
        setScan(scanLab())
      } catch {
        /* keep the previous scan on failure */
      } finally {
        if (token === scanToken.current) setScanning(false)
      }
    }, 350)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(refreshScan, 450)
    return () => window.clearTimeout(timer)
  }, [devices, links, status, refreshScan])

  const send = (raw: string) => {
    const value = raw.trim()
    if (!value || status !== 'idle') return
    handleMessage(value)
    setInput('')
  }

  const runAction = (action: { kind: string; changeIds?: string[]; text?: string }) => {
    if (status !== 'idle') return
    if (action.kind === 'apply-plan') applyPlan()
    else if (action.kind === 'apply-changes') applyPlan(action.changeIds)
    else if (action.kind === 'cancel-plan') cancelPlan()
    else if (action.kind === 'send' && action.text) send(action.text)
  }

  const busy = status !== 'idle'

  const problems = scan?.problems ?? []
  const matrix = scan?.matrix ?? []
  const failed = matrix.filter((test) => !test.success).length
  const passPct = matrix.length ? Math.round(((matrix.length - failed) / matrix.length) * 100) : 0

  return (
    <div className="assistant-panel">
      {/* Header */}
      <header className="assistant-header">
        <div className="assistant-header-row">
          <div className="assistant-avatar">
            <Bot className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="assistant-title">NetOps Copilot</div>
            <div className="assistant-subtitle">Your networking lab copilot</div>
          </div>
          <span className={`assistant-status status-${status}`}>
            <span className="assistant-status-dot" />
            {STATUS_LABEL[status]}
          </span>
        </div>
        <div className="assistant-toolbar">
          <div className="assistant-mode-switch" role="tablist" aria-label="Assistant mode">
            <button type="button" role="tab" aria-selected={mode === 'learning'}
              className={mode === 'learning' ? 'active' : ''}
              onClick={() => setMode('learning')}>
              <Brain className="h-3 w-3" strokeWidth={2} />
              Learning
            </button>
            <button type="button" role="tab" aria-selected={mode === 'takeover'}
              className={mode === 'takeover' ? 'active' : ''}
              onClick={() => setMode('takeover')}>
              <Zap className="h-3 w-3" strokeWidth={2} />
              Takeover
            </button>
          </div>
          {selected && (
            <span className="assistant-context" title="Currently selected device">
              Selected: <strong>{selected.hostname}</strong>
            </span>
          )}
          <span className="assistant-toolbar-spacer" />
          <button type="button" className="assistant-clear" onClick={() => setShowHistory((v) => !v)}>
            History
          </button>
          <button type="button" className="assistant-clear" onClick={clearChat} disabled={busy}>
            Clear
          </button>
        </div>
      </header>
      {/* Chat area */}
      <div className="assistant-chat" ref={scrollRef}>
        {messages.map((message) => {
          if (message.role === 'user') {
            return (
              <div key={message.id} className="assistant-msg user">
                <div className="assistant-bubble user">
                  <span>{message.text}</span>
                </div>
              </div>
            )
          }

          if (message.kind === 'tests' && message.tests) {
            return (
              <div key={message.id} className="assistant-msg assistant">
                <div className="assistant-bubble assistant">
                  <p className="assistant-text">{message.text}</p>
                  <div className="assistant-tests">
                    {message.tests.map((test, index) => (
                      <div key={index} className={`assistant-test ${test.success ? 'pass' : 'fail'}`}>
                        <span className="assistant-test-icon">
                          {test.success
                            ? <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
                            : <X className="h-3.5 w-3.5" strokeWidth={2.25} />}
                        </span>
                        <span className="assistant-test-route">{test.source} -&gt; {test.destination}</span>
                        <span className="assistant-test-detail">
                          {test.success ? `${test.latencyMs ?? '?'}ms` : test.failureReason ?? 'failed'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          }

          if (message.kind === 'plan') {
            const plan = pendingPlan && message.planId === pendingPlan.id ? pendingPlan : null
            return (
              <div key={message.id} className="assistant-msg assistant">
                <div className="assistant-bubble assistant">
                  <p className="assistant-text">{message.text}</p>
                  {plan && (
                    <div className="assistant-plan">
                      <div className="assistant-plan-title">{plan.title}</div>
                      <ul>
                        {plan.changes.map((change) => (
                          <li key={change.id}>
                            <span className="assistant-plan-check">
                              <Check className="h-3 w-3" strokeWidth={2.5} />
                            </span>
                            <span>{change.summary}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="assistant-plan-actions">
                        <button type="button" className="assistant-btn primary" disabled={busy}
                          onClick={() => runAction({ kind: 'apply-plan' })}>
                          Apply {plan.changes.length} change{plan.changes.length === 1 ? '' : 's'}
                        </button>
                        <button type="button" className="assistant-btn ghost" disabled={busy}
                          onClick={() => runAction({ kind: 'cancel-plan' })}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {!plan && <div className="assistant-plan muted-note">This plan was already handled.</div>}
                </div>
              </div>
            )
          }

          return (
            <div key={message.id} className="assistant-msg assistant">
              <div className={`assistant-bubble assistant${message.muted ? ' muted' : ''}`}>
                <p className="assistant-text">{message.text}</p>
                {message.actions && message.actions.length > 0 && (
                  <div className="assistant-plan-actions">
                    {message.actions.map((action) => (
                      <button key={action.id} type="button"
                        className={`assistant-btn ${action.style ?? 'ghost'}`}
                        disabled={busy}
                        onClick={() => runAction(action)}>
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {status === 'thinking' && (
          <div className="assistant-msg assistant">
            <div className="assistant-bubble assistant typing">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      {/* Live diagnostics */}
      <section className="assistant-diagnostics" aria-label="Live diagnostics">
        <div className="assistant-diagnostics-head">
          <span className="assistant-diagnostics-label">Live diagnostics</span>
          <span className={`assistant-diag-count ${problems.length ? 'bad' : 'good'}`}>
            {problems.length ? `${problems.length} issue${problems.length === 1 ? '' : 's'}` : 'All clear'}
          </span>
          <div className="assistant-diag-actions">
            <button type="button" className="assistant-diag-iconbtn" title="Re-run diagnostics"
              disabled={busy} onClick={refreshScan}>
              <RefreshCw className={`h-3.5 w-3.5${scanning ? ' spin' : ''}`} strokeWidth={2} />
            </button>
            <button type="button" className="assistant-diag-iconbtn"
              title={diagOpen ? 'Collapse diagnostics' : 'Expand diagnostics'}
              onClick={() => setDiagOpen((v) => !v)}>
              <ChevronDown className={`h-3.5 w-3.5${diagOpen ? '' : ' flipped'}`} strokeWidth={2} />
            </button>
          </div>
        </div>
        {diagOpen && (
          <div className="assistant-diagnostics-body">
            {!scan && <div className="assistant-diag-empty">Scanning the topology...</div>}

            {problems.slice(0, 6).map((problem, index) => (
              <div key={`${problem.summary}-${index}`} className={`assistant-diag-card ${problem.severity}`}>
                <span className="assistant-diag-icon">
                  <TriangleAlert className="h-4 w-4" strokeWidth={2} />
                </span>
                <div className="assistant-diag-main">
                  <div className="assistant-diag-title">{problem.summary}</div>
                  <div className="assistant-diag-detail">{problem.detail}</div>
                </div>
                <button type="button" className="assistant-diag-fix" disabled={busy}
                  title="Ask the assistant to diagnose and propose a fix"
                  onClick={() => send(`Diagnose and fix this: ${problem.summary}`)}>
                  Fix
                </button>
              </div>
            ))}

            {/* Connectivity health summary with pass-rate bar */}
            <div className="assistant-diag-card health">
              <span className={`assistant-diag-icon ${failed ? 'crit' : 'ok'}`}>
                <Activity className="h-4 w-4" strokeWidth={2} />
              </span>
              <div className="assistant-diag-main">
                <div className="assistant-diag-title">Connectivity</div>
                <div className="assistant-diag-detail">
                  {matrix.length
                    ? `${matrix.length - failed}/${matrix.length} endpoint tests passing`
                    : 'No endpoint pairs to test yet'}
                </div>
              </div>
              <span className={`assistant-diag-flag ${failed ? 'bad' : 'good'}`}>
                {failed ? 'Failures' : 'Passing'}
              </span>
              {matrix.length > 0 && (
                <div className="assistant-diag-bar">
                  <span className={failed ? 'bad' : 'good'} style={{ width: `${passPct}%` }} />
                </div>
              )}
            </div>

            {scan && problems.length === 0 && (
              <div className="assistant-diag-card ok">
                <span className="assistant-diag-icon">
                  <Check className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <div className="assistant-diag-main">
                  <div className="assistant-diag-title">No misconfigurations detected</div>
                  <div className="assistant-diag-detail">Gateways, interfaces, and cabling all look healthy.</div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Suggestion chips */}
      <div className="assistant-suggestions">
        {SUGGESTIONS.map((suggestion) => (
          <button key={suggestion} type="button" disabled={busy} onClick={() => send(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>

      {/* Action history (toggle from the toolbar) */}
      {showHistory && (
        <div className="assistant-history">
          <ul>
            {actions.length === 0 && <li className="empty">No actions yet.</li>}
            {actions.slice().reverse().map((action) => (
              <li key={action.id}>
                <span className="time">{new Date(action.timestamp).toLocaleTimeString()}</span>
                <span>{action.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Composer */}
      <form
        className="assistant-input"
        onSubmit={(event) => {
          event.preventDefault()
          send(input)
        }}
      >
        <span className="assistant-attach" title="Attachments are not supported yet">
          <Paperclip className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask Copilot..."
          disabled={busy}
          aria-label="Ask Copilot"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send">
          <Send className="h-4 w-4" strokeWidth={1.9} />
        </button>
      </form>
    </div>
  )
}