import { create } from 'zustand'
import type { CableKind, DeviceType } from '@/network/types'

type View = 'dashboard' | 'learn' | 'devicelab' | 'topology' | 'traffic' | 'issues' | 'agents' | 'reports' | 'labs' | 'settings' | 'terminal'

export type TopologyTool = 'select' | 'wire' | 'delete' | 'place'

let noticeTimer: ReturnType<typeof setTimeout> | undefined

interface UIState {
  activeView: View
  sidebarCollapsed: boolean
  /** Device Lab: true while a lesson (with the interactive device) is open - the right sidebar is only useful then. */
  deviceLabLessonOpen: boolean
  /** Device Lab: true once the user pressed "Ask Copilot" so the right sidebar (Copilot mode) is shown. */
  deviceLabCopilotRequested: boolean
  /** Deep-link request to open Device Lab directly at a lesson (e.g. "Try in Device Lab" from Learn). */
  pendingDeviceLabLesson: { kind: 'router' | 'switch' | 'server' | 'pc'; lessonId: string } | null
  topologyTool: TopologyTool
  pendingDeviceType: DeviceType
  wireKind: CableKind
  topologyNotice: string | null
  setActiveView: (view: View) => void
  toggleSidebar: () => void
  setDeviceLabLessonOpen: (open: boolean) => void
  setDeviceLabCopilotRequested: (requested: boolean) => void
  openDeviceLabLesson: (kind: 'router' | 'switch' | 'server' | 'pc', lessonId: string) => void
  clearPendingDeviceLabLesson: () => void
  setTopologyTool: (tool: TopologyTool) => void
  setPendingDeviceType: (type: DeviceType) => void
  setWireKind: (kind: CableKind) => void
  setTopologyNotice: (notice: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'topology',
  sidebarCollapsed: false,
  deviceLabLessonOpen: false,
  deviceLabCopilotRequested: false,
  pendingDeviceLabLesson: null,
  topologyTool: 'select',
  pendingDeviceType: 'pc',
  wireKind: 'copper',
  topologyNotice: null,
  setActiveView: (activeView) =>
    set(
      activeView === 'devicelab'
        ? { activeView }
        : // Leaving Device Lab always tears down its right sidebar - the AI
          // Copilot is scoped to an open lesson and must not follow the user
          // into Learn, Topology, etc.
          { activeView, deviceLabLessonOpen: false, deviceLabCopilotRequested: false },
    ),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setDeviceLabLessonOpen: (deviceLabLessonOpen) =>
    set(
      deviceLabLessonOpen
        ? { deviceLabLessonOpen: true }
        : // Closing the lesson (back to the picker) also closes the Copilot -
          // it should never linger on the lesson list.
          { deviceLabLessonOpen: false, deviceLabCopilotRequested: false },
    ),
  setDeviceLabCopilotRequested: (deviceLabCopilotRequested) =>
    set({ deviceLabCopilotRequested }),
  openDeviceLabLesson: (kind, lessonId) =>
    set({ activeView: 'devicelab', pendingDeviceLabLesson: { kind, lessonId } }),
  clearPendingDeviceLabLesson: () => set({ pendingDeviceLabLesson: null }),
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
