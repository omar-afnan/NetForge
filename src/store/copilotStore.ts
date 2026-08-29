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

export interface LabAssistState {
  enabled: boolean
  labId: string | null
  steps: AssistStep[]
  currentStepIndex: number
  highlightDeviceId: string | null
  busy: boolean
}

const DEFAULT_ASSIST: LabAssistState = {
  enabled: false,
  labId: null,
  steps: [],
  currentStepIndex: -1,
  highlightDeviceId: null,
  busy: false,
}

const GREETING: AssistantMessage = {
  id: 'assistant-greeting',
  role: 'assistant',
  kind: 'text',
  text: [
    'Hi! I am NetOps Copilot, your networking lab assistant. ',
    '',
    'I can see your live topology, run real diagnostics, explain networking concepts, and — in Takeover mode apply configurations for you.',
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
  addAction: (action: AgentAction) => void
  clearActions: () => void
  pushMessage: (message: AssistantMessage) => void
  setMode: (mode: AssistantMode) => void
  setStatus: (status: AssistantStatus) => void
  setPendingPlan: (pendingPlan: LabPlan | null) => void
  startLabAssist: (labId: string, steps: AssistStep[]) => void
  advanceLabAssist: () => void
  setLabAssistHighlight: (deviceId: string | null) => void
  setLabAssistBusy: (busy: boolean) => void
  stopLabAssist: () => void
  clearChat: () => void
}

export const useCopilotStore = create<CopilotState>((set) => ({
  actions: [],
  messages: [GREETING],
  mode: 'learning',
  status: 'idle',
  pendingPlan: null,
  labAssist: DEFAULT_ASSIST,
  addAction: (action) => set((state) => ({ actions: [...state.actions, action] })),
  clearActions: () => set({ actions: [] }),
  pushMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setMode: (mode) => set({ mode }),
  setStatus: (status) => set({ status }),
  setPendingPlan: (pendingPlan) => set({ pendingPlan }),
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
  stopLabAssist: () => set({ labAssist: DEFAULT_ASSIST }),
  clearChat: () => set({ messages: [GREETING], pendingPlan: null, labAssist: DEFAULT_ASSIST }),
}))
