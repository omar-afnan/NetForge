import { create } from 'zustand'
import type { AgentAction } from '@/network/types'

interface CopilotState {
  actions: AgentAction[]
  addAction: (action: AgentAction) => void
}

export const useCopilotStore = create<CopilotState>((set) => ({
  actions: [],
  addAction: (action) => set((state) => ({ actions: [...state.actions, action] })),
}))
