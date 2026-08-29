import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, SendHorizonal } from 'lucide-react'
import { useCopilotStore } from '@/store/copilotStore'
import { useNetworkStore } from '@/store/networkStore'
import { handleMessage, applyPlan, cancelPlan } from '@/assistant/engine'
import { runLabAssist } from '@/assistant/labAssist'

const SUGGESTIONS = [
  'Find the problem',
  'Run connectivity tests',
  'Why can\'t PC-01 ping SRV-01?',
  'Complete this lab for me',
  'Explain default gateways',
]

export function AICopilotPanel() {
  const messages = useCopilotStore((s) => s.messages)
  const mode = useCopilotStore((s) => s.mode)
  const status = useCopilotStore((s) => s.status)
  const pendingPlan = useCopilotStore((s) => s.pendingPlan)
  const actions = useCopilotStore((s) => s.actions)
  const labAssist = useCopilotStore((s) => s.labAssist)
  const setMode = useCopilotStore((s) => s.setMode)
  const clearChat = useCopilotStore((s) => s.clearChat)
  const startLabAssist = useCopilotStore((s) => s.startLabAssist)
  const stopLabAssist = useCopilotStore((s) => s.stopLabAssist)

  const selectedDeviceId = useNetworkStore((s) => s.selectedDeviceId)
  const devices = useNetworkStore((s) => s.devices)
  const lab = useNetworkStore((s) => s.lab)
  const selected = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  )

  const [input, setInput] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, status, labAssist])

  const send = (raw: string) => {
    const value = raw.trim()
    if (!value || status !== 'idle') return
    handleMessage(value)
    setInput('')
  }

  const busy = status !== 'idle' || labAssist.busy

  return (
    <div className="ai-copilot-panel">
      <div className="ai-copilot-header">
        <div className="ai-copilot-header-left">
          <div className="ai-copilot-avatar">
            <Bot className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div>
            <div className="ai-copilot-title">
              {labAssist.enabled ? `✨ AI Copilot` : 'AI Copilot'}
            </div>
            <div className="ai-copilot-subtitle">
              {labAssist.enabled ? `Lab Assist Mode · ${lab.title}` : 'Your networking assistant'}
            </div>
          </div>
        </div>
        <div className="ai-copilot-header-right">
          {labAssist.enabled && (
            <button
              type="button"
              className="ai-copilot-takeover-btn"
              disabled={busy}
              onClick={() => {
                stopLabAssist()
                useCopilotStore.getState().setStatus('idle')
                useNetworkStore.getState().setHighlightedDevice(null)
              }}
            >
              Exit Assist
            </button>
          )}
          <div className={`ai-copilot-status status-${status}`}>
            <span className="ai-copilot-status-dot" />
            {labAssist.enabled
              ? 'Investigating'
              : status === 'idle'
                ? 'Ready'
                : status === 'thinking'
                  ? 'Thinking...'
                  : 'Working...'}
          </div>
        </div>
      </div>

      {labAssist.enabled && (
        <div className="ai-copilot-lab-assist">
          <div className="ai-copilot-timeline">
            {labAssist.steps.map((step) => (
              <div key={step.id} className={`ai-copilot-timeline-step step-${step.status}`}>
                <div className="ai-copilot-timeline-indicator">
                  {step.status === 'done' && '✓'}
                  {step.status === 'active' && '●'}
                  {step.status === 'error' && '✗'}
                  {step.status === 'pending' && '○'}
                </div>
                <div className="ai-copilot-timeline-content">
                  <div className="ai-copilot-timeline-label">{step.label}</div>
                  {step.detail && <div className="ai-copilot-timeline-detail">{step.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ai-copilot-toolbar">
        <div className="ai-copilot-mode-switch" role="tablist" aria-label="Assistant mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'learning'}
            className={mode === 'learning' ? 'active' : ''}
            onClick={() => setMode('learning')}
          >
            Learning
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'takeover'}
            className={mode === 'takeover' ? 'active' : ''}
            onClick={() => setMode('takeover')}
          >
            Takeover
          </button>
        </div>
        {selected && !labAssist.enabled && (
          <span className="ai-copilot-context" title="Currently selected device">
            Selected: <strong>{selected.hostname}</strong>
          </span>
        )}
        {labAssist.enabled && labAssist.steps.some((s) => s.status === 'done' && s.id === 'verify') && (
          <span className="ai-copilot-context ai-copilot-complete-badge">✓ Lab Complete</span>
        )}
        <button type="button" className="ai-copilot-clear" onClick={clearChat} disabled={busy}>
          Clear
        </button>
      </div>

      {!labAssist.enabled && (
        <div className="ai-copilot-takeover-bar">
          <button
            type="button"
            className="ai-copilot-takeover-trigger"
            disabled={busy || lab.id === 'starter'}
            onClick={() => {
              if (lab.id && lab.id !== 'starter') {
                setMode('takeover')
                startLabAssist(lab.id, [])
                window.setTimeout(() => runLabAssist(lab.id), 0)
              }
            }}
          >
            ✨ Take Over This Lab
          </button>
          {lab.id === 'starter' && (
            <span className="ai-copilot-takeover-hint">Load a lab to enable takeover</span>
          )}
        </div>
      )}

      <div className="ai-copilot-chat" ref={scrollRef}>
        {messages.map((message) => {
          if (message.role === 'user') {
            return (
              <div key={message.id} className="ai-copilot-msg user">
                <div className="ai-copilot-bubble user">{message.text}</div>
              </div>
            )
          }

          if (message.kind === 'plan') {
            const plan = pendingPlan && message.planId === pendingPlan.id ? pendingPlan : null
            return (
              <div key={message.id} className="ai-copilot-msg assistant">
                <div className="ai-copilot-bubble assistant">
                  <p className="ai-copilot-text">{message.text}</p>
                  {plan && (
                    <div className="ai-copilot-plan">
                      <div className="ai-copilot-plan-title">{plan.title}</div>
                      <ul>
                        {plan.changes.map((change) => (
                          <li key={change.id}>
                            <span className="ai-copilot-plan-check">✓</span>
                            <span>{change.summary}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="ai-copilot-plan-actions">
                        <button type="button" className="ai-copilot-btn primary" disabled={busy} onClick={() => applyPlan()}>
                          Apply {plan.changes.length} change{plan.changes.length === 1 ? '' : 's'}
                        </button>
                        <button type="button" className="ai-copilot-btn ghost" disabled={busy} onClick={() => cancelPlan()}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          }

          return (
            <div key={message.id} className="ai-copilot-msg assistant">
              <div className={`ai-copilot-bubble assistant${message.muted ? ' muted' : ''}`}>
                <p className="ai-copilot-text">{message.text}</p>
              </div>
            </div>
          )
        })}

        {status === 'thinking' && (
          <div className="ai-copilot-msg assistant">
            <div className="ai-copilot-bubble assistant typing">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      <div className="ai-copilot-suggestions">
        {SUGGESTIONS.map((suggestion) => (
          <button key={suggestion} type="button" disabled={busy} onClick={() => send(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>

      <form
        className="ai-copilot-input"
        onSubmit={(event) => {
          event.preventDefault()
          send(input)
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask anything about your network..."
          disabled={busy}
          aria-label="Ask anything about your network"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send">
          <SendHorizonal className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </form>

      <div className="ai-copilot-history">
        <button type="button" onClick={() => setShowHistory((value) => !value)}>
          History · {actions.length} action{actions.length === 1 ? '' : 's'} {showHistory ? '▾' : '▸'}
        </button>
        {showHistory && (
          <ul>
            {actions.length === 0 && <li className="empty">No actions yet.</li>}
            {actions.slice().reverse().map((action) => (
              <li key={action.id}>
                <span className="time">{new Date(action.timestamp).toLocaleTimeString()}</span>
                <span>{action.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
