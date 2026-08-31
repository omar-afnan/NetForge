import { create } from 'zustand'
import type { CableKind, DeviceType } from '@/network/types'

type View = 'dashboard' | 'learn' | 'topology' | 'traffic' | 'issues' | 'agents' | 'reports' | 'labs' | 'settings' | 'terminal'

export type TopologyTool = 'select' | 'wire' | 'delete' | 'place'

let noticeTimer: ReturnType<typeof setTimeout> | undefined

interface UIState {
  activeView: View
  sidebarCollapsed: boolean
  topologyTool: TopologyTool
  pendingDeviceType: DeviceType
  wireKind: CableKind
  topologyNotice: string | null
  setActiveView: (view: View) => void
  toggleSidebar: () => void
  setTopologyTool: (tool: TopologyTool) => void
  setPendingDeviceType: (type: DeviceType) => void
  setWireKind: (kind: CableKind) => void
  setTopologyNotice: (notice: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'topology',
  sidebarCollapsed: false,
  topologyTool: 'select',
  pendingDeviceType: 'pc',
  wireKind: 'copper',
  topologyNotice: null,
  setActiveView: (activeView) => set({ activeView }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTopologyTool: (topologyTool) => set({ topologyTool }),
  setPendingDeviceType: (pendingDeviceType) => set({ pendingDeviceType }),
  setWireKind: (wireKind) => set({ wireKind }),
  setTopologyNotice: (topologyNotice) => {
    if (noticeTimer) clearTimeout(noticeTimer)
    if (!topologyNotice) {
      set({ topologyNotice: null })
      return
    }
    set({ topologyNotice })
    noticeTimer = setTimeout(() => set({ topologyNotice: null }), 2800)
  },
}))
