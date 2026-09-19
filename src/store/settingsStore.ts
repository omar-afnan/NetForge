import { create } from 'zustand'
import { bool, isRecord, readPersisted, str, writePersisted } from '@/lib/persist'

export interface AppSettings {
  showTopologyGrid: boolean
  glowEffects: boolean
  compactTables: boolean
  useSelectedDeviceForTerminal: boolean
  defaultTerminalDevice: string
  showLinkPulse: boolean
}

const STORAGE_KEY = 'netforge-settings'
const SCHEMA_VERSION = 1

const defaultSettings: AppSettings = {
  showTopologyGrid: true,
  glowEffects: true,
  compactTables: false,
  useSelectedDeviceForTerminal: true,
  defaultTerminalDevice: 'PC-01',
  showLinkPulse: true,
}

/** Field-by-field: unknown keys are dropped, wrong types fall back to defaults. */
export function sanitizeSettings(raw: unknown): AppSettings | null {
  if (!isRecord(raw)) return null
  const d = defaultSettings
  return {
    showTopologyGrid: bool(raw.showTopologyGrid, d.showTopologyGrid),
    glowEffects: bool(raw.glowEffects, d.glowEffects),
    compactTables: bool(raw.compactTables, d.compactTables),
    useSelectedDeviceForTerminal: bool(raw.useSelectedDeviceForTerminal, d.useSelectedDeviceForTerminal),
    defaultTerminalDevice: str(raw.defaultTerminalDevice, d.defaultTerminalDevice, 64) || d.defaultTerminalDevice,
    showLinkPulse: bool(raw.showLinkPulse, d.showLinkPulse),
  }
}

function loadSettings(): AppSettings {
  return readPersisted(STORAGE_KEY, SCHEMA_VERSION, sanitizeSettings) ?? defaultSettings
}

function saveSettings(settings: AppSettings) {
  writePersisted(STORAGE_KEY, SCHEMA_VERSION, settings)
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
