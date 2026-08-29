import type { PingResult } from '@/network/types'

export type ChangeKind =
  | 'interface'
  | 'interface-status'
  | 'gateway'
  | 'route-add'
  | 'route-remove'
  | 'link-status'
  | 'link-add'

export interface ProposedChange {
  id: string
  kind: ChangeKind
  deviceId?: string
  deviceName?: string
  /** Hostname the change applies to (resolution happens at apply time). */
  deviceRef?: string
  /** One-line human-readable description of the change. */
  summary: string
  /** Why the assistant wants to make this change. */
  detail?: string
  payload: Record<string, unknown>
}

/** Compact connectivity test row used across the assistant tools. */
export interface PingTest {
  source: string
  destination: string
  success: boolean
  detail: string
}


export interface LabPlan {
  id: string
  title: string
  rationale: string[]
  changes: ProposedChange[]
}

export type MessageActionKind = 'apply-plan' | 'cancel-plan' | 'apply-changes' | 'send'

export interface MessageAction {
  id: string
  label: string
  kind: MessageActionKind
  style?: 'primary' | 'ghost' | 'danger'
  /** Restrict an apply action to a subset of the plan's changes. */
  changeIds?: string[]
  /** Text to send for 'send' actions. */
  text?: string
}

export type MessageKind = 'text' | 'plan' | 'tests'

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  kind: MessageKind
  text: string
  /** Muted progress lines (e.g. "Applying 1/4 …") render compactly. */
  muted?: boolean
  planId?: string
  tests?: PingResult[]
  actions?: MessageAction[]
}

export interface ToolResult<T = unknown> {
  ok: boolean
  error?: string
  data?: T
}
