import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, SendHorizonal, User } from 'lucide-react'
import { useCopilotStore } from '@/store/copilotStore'
import { useNetworkStore } from '@/store/networkStore'
import { applyPlan, cancelPlan, handleMessage } from '@/assistant/engine'

const SUGGESTIONS = [
  'Find the problem',
  'Run connectivity tests',
  'Why can\'t PC-01 ping SRV-01?',
  'Complete this lab for me',
  'Explain default gateways',
]

const STATUS_LABEL = {
  idle: 'Ready',
  thinking: 'Thinking…',
  working: 'Working…',
} as const

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
  const selected = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  )

  const [input, setInput] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Keep the latest message visible.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, status])

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

  return (
    <div className="assistant-panel">
      {/* Header */}
      <header className="assistant-header">
        <div className="assistant-header-row">
          <div className="assistant-avatar">
            <Bot className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="assistant-title">AI Lab Assistant</div>
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
              Learning
            </button>
            <button type="button" role="tab" aria-selected={mode === 'takeover'}
              className={mode === 'takeover' ? 'active' : ''}
              onClick={() => setMode('takeover')}>
              Takeover
            </button>
          </div>
          {selected && (
            <span className="assistant-context" title="Currently selected device">
              Selected: <strong>{selected.hostname}</strong>
            </span>
          )}
          <button type="button" className="assistant-clear" onClick={clearChat} disabled={busy}>
            Clear
          </button>
        </div>
      </header>

      {/* Chat area */}
      <div className="assistant-chat" ref={scrollRef}>
