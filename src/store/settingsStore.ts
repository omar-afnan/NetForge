import { create } from 'zustand'

export interface AppSettings {
  showTopologyGrid: boolean
  glowEffects: boolean
  compactTables: boolean
  useSelectedDeviceForTerminal: boolean
  defaultTerminalDevice: string
  showLinkPulse: boolean
}

const STORAGE_KEY = 'netforge-settings'

const defaultSettings: AppSettings = {
  showTopologyGrid: true,
  glowEffects: true,
  compactTables: false,
  useSelectedDeviceForTerminal: true,
  defaultTerminalDevice: 'PC-01',
  showLinkPulse: true,
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return defaultSettings
  }
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

interface SettingsState extends AppSettings {
  updateSettings: (patch: Partial<AppSettings>) => void
  resetSettings: () => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...loadSettings(),

  updateSettings: (patch) =>
    set((state) => {
      const next = { ...state, ...patch }
      saveSettings({
        showTopologyGrid: next.showTopologyGrid,
        glowEffects: next.glowEffects,
        compactTables: next.compactTables,
        useSelectedDeviceForTerminal: next.useSelectedDeviceForTerminal,
        defaultTerminalDevice: next.defaultTerminalDevice,
        showLinkPulse: next.showLinkPulse,
      })
      return next
    }),

  resetSettings: () => {
    saveSettings(defaultSettings)
    set((state) => ({
      ...state,
      ...defaultSettings,
    }))
  },
}))
