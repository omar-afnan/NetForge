import { create } from 'zustand'
import type { AgentAction } from '@/network/types'
import type { AssistantMessage, LabPlan } from '@/assistant/types'

export type AssistantMode = 'learning' | 'takeover'
export type AssistantStatus = 'idle' | 'thinking' | 'working'

export interface AssistStep {
  id: string
  label: string
  detail?: string
  status: 'pending' | 'active' | 'done' | 'error'
}

export type TakeoverPhase = 'idle' | 'working' | 'summary' | 'complete'
export type TakeoverTone = 'info' | 'ok' | 'warn' | 'cmd' | 'header'

export interface TakeoverLine {
  id: string
  text: string
  tone: TakeoverTone
}

export interface LabAssistState {
  enabled: boolean
  labId: string | null
  steps: AssistStep[]
  currentStepIndex: number
  highlightDeviceId: string | null
  busy: boolean
  /** Live "AI is solving the lab" feed shown over the topology. */
  phase: TakeoverPhase
  feed: TakeoverLine[]
  /** Plain-English summary the AI types out after solving the lab. */
  summary: string | null
}

const DEFAULT_ASSIST: LabAssistState = {
  enabled: false,
  labId: null,
  steps: [],
  currentStepIndex: -1,
  highlightDeviceId: null,
  busy: false,
  phase: 'idle',
  feed: [],
  summary: null,
}

const GREETING: AssistantMessage = {
  id: 'assistant-greeting',
  role: 'assistant',
  kind: 'text',
  text: [
    'Hi! I am NetOps Copilot, your networking lab assistant. ',
    '',
    'I can see your live topology, run real diagnostics, explain networking concepts, and - in Takeover mode apply configurations for you.',
    '',
    'Try: "Why can\'t PC-01 ping SRV-01?", "Find the problem", or "Complete this lab for me".',
  ].join('\n'),
}

interface CopilotState {
  actions: AgentAction[]
  messages: AssistantMessage[]
  mode: AssistantMode
  status: AssistantStatus
  pendingPlan: LabPlan | null
  labAssist: LabAssistState
  activeLabId: string | null
  labConversations: Record<string, AssistantMessage[]>
  /**
   * Bumped every time the active lab changes. Long-running async drivers
   * (AI takeover) capture it at start and abort when it changes, so a stale
   * run can never mutate or complete a different lab.
   */
  assistEpoch: number
  addAction: (action: AgentAction) => void
  clearActions: () => void
  pushMessage: (message: AssistantMessage) => void
  setMode: (mode: AssistantMode) => void
  setStatus: (status: AssistantStatus) => void
  setPendingPlan: (pendingPlan: LabPlan | null) => void
  switchLab: (labId: string, options?: { fresh?: boolean }) => void
  startLabAssist: (labId: string, steps: AssistStep[]) => void
  advanceLabAssist: () => void
  setLabAssistHighlight: (deviceId: string | null) => void
  setLabAssistBusy: (busy: boolean) => void
  setLabAssistSteps: (steps: AssistStep[]) => void
  setTakeoverPhase: (phase: TakeoverPhase) => void
  pushTakeoverLine: (text: string, tone?: TakeoverTone) => void
  setTakeoverSummary: (summary: string | null) => void
  stopLabAssist: () => void
  clearChat: () => void
}

export const useCopilotStore = create<CopilotState>((set, get) => ({
  actions: [],
  messages: [GREETING],
  mode: 'learning',
  status: 'idle',
  pendingPlan: null,
  labAssist: DEFAULT_ASSIST,
  activeLabId: null,
  labConversations: {},
  assistEpoch: 0,
  addAction: (action) => set((state) => ({ actions: [...state.actions, action] })),
  clearActions: () => set({ actions: [] }),
  pushMessage: (message) => set((state) => {
    const labId = state.activeLabId ?? 'default'
    const conversations = { ...state.labConversations }
    const current = conversations[labId] ?? [GREETING]
    const updated = [...current, message]
    conversations[labId] = updated
    return { messages: updated, labConversations: conversations }
  }),
  setMode: (mode) => set({ mode }),
  setStatus: (status) => set({ status }),
  setPendingPlan: (pendingPlan) => set({ pendingPlan }),
  switchLab: (labId, options) => {
    const state = get()
    const conversations = { ...state.labConversations }
    // A lab load always starts a fresh conversation for that lab - never
    // restore messages from a previous run or from another lab.
    if (options?.fresh || !conversations[labId]) {
      conversations[labId] = [GREETING]
    }
    set({
      activeLabId: labId,
      messages: conversations[labId],
      labConversations: conversations,
      labAssist: DEFAULT_ASSIST,
      pendingPlan: null,
      status: 'idle',
      mode: 'learning',
      assistEpoch: state.assistEpoch + 1,
    })
  },
  startLabAssist: (labId, steps) => set({ labAssist: { ...DEFAULT_ASSIST, enabled: true, labId, steps, currentStepIndex: 0, busy: true } }),
  advanceLabAssist: () => set((state) => {
    const next = state.labAssist.currentStepIndex + 1
    const updatedSteps: AssistStep[] = state.labAssist.steps.map((step): AssistStep => {
      const idx = state.labAssist.steps.indexOf(step)
      if (idx < next) return { ...step, status: 'done' }
      if (idx === next) return { ...step, status: 'active' }
      return { ...step, status: 'pending' }
    })
    return {
      labAssist: {
        ...state.labAssist,
        currentStepIndex: next,
        steps: updatedSteps,
        busy: next < updatedSteps.length - 1,
      },
    }
  }),
  setLabAssistHighlight: (deviceId) => set((state) => ({ labAssist: { ...state.labAssist, highlightDeviceId: deviceId } })),
  setLabAssistBusy: (busy) => set((state) => ({ labAssist: { ...state.labAssist, busy } })),
  setLabAssistSteps: (steps) => set((state) => ({ labAssist: { ...state.labAssist, steps } })),
  setTakeoverPhase: (phase) => set((state) => ({ labAssist: { ...state.labAssist, phase } })),
  pushTakeoverLine: (text, tone = 'info') =>
    set((state) => ({
      labAssist: {
        ...state.labAssist,
        feed: [...state.labAssist.feed, { id: crypto.randomUUID(), text, tone }],
      },
    })),
  setTakeoverSummary: (summary) => set((state) => ({ labAssist: { ...state.labAssist, summary } })),
  stopLabAssist: () => set({ labAssist: DEFAULT_ASSIST }),
  clearChat: () => set((state) => {
    const labId = state.activeLabId ?? 'default'
    const conversations = { ...state.labConversations }
    conversations[labId] = [GREETING]
    return { messages: [GREETING], labConversations: conversations, pendingPlan: null, labAssist: DEFAULT_ASSIST }
  }),
}))
