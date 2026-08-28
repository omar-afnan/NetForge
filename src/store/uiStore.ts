import { create } from 'zustand'

type View = 'dashboard' | 'topology' | 'traffic' | 'issues' | 'agents' | 'reports' | 'labs' | 'settings'

interface UIState {
  activeView: View
  sidebarCollapsed: boolean
  setActiveView: (view: View) => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'topology',
  sidebarCollapsed: false,
  setActiveView: (activeView) => set({ activeView }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}))
