import { create } from 'zustand'
import type { AgentAction } from '@/network/types'
import type { AssistantMessage, LabPlan } from '@/assistant/types'

export type AssistantMode = 'learning' | 'takeover'
export type AssistantStatus = 'idle' | 'thinking' | 'working'

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
  addAction: (action: AgentAction) => void
  clearActions: () => void
  pushMessage: (message: AssistantMessage) => void
  setMode: (mode: AssistantMode) => void
  setStatus: (status: AssistantStatus) => void
  setPendingPlan: (plan: LabPlan | null) => void
  clearChat: () => void
}

export const useCopilotStore = create<CopilotState>((set) => ({
  actions: [],
  messages: [GREETING],
  mode: 'learning',
  status: 'idle',
  pendingPlan: null,
  addAction: (action) => set((state) => ({ actions: [...state.actions, action] })),
  clearActions: () => set({ actions: [] }),
  pushMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setMode: (mode) => set({ mode }),
  setStatus: (status) => set({ status }),
  setPendingPlan: (pendingPlan) => set({ pendingPlan }),
  clearChat: () => set({ messages: [GREETING], pendingPlan: null }),
}))
