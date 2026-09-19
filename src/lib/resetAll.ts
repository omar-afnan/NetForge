import { useNetworkStore } from '@/store/networkStore'
import { useLearnProgress } from '@/store/progressStore'
import { useConceptMastery } from '@/store/masteryStore'
import { useDeviceLabStore } from '@/store/deviceLabStore'
import { useSettingsStore } from '@/store/settingsStore'
import { removePersisted } from '@/lib/persist'

/** Every localStorage key NetForge owns. */
export const ALL_STORAGE_KEYS = [
  'netforge-network',
  'netforge-lab-progress',
  'netforge-device-lab',
  'netforge-learn-progress',
  'netforge-concept-mastery',
  'netforge-settings',
  'netforge-issue-history',
] as const

/**
 * Erase all saved progress. Order matters: the network store re-saves itself on
 * every state change, so the in-memory resets run FIRST and the storage keys are
 * removed LAST - otherwise a reset would immediately re-write the old topology.
 */
export function resetAllProgress(): void {
  useNetworkStore.getState().resetAllLabs()
  useLearnProgress.getState().resetProgress()
  useConceptMastery.getState().reset()
  useDeviceLabStore.getState().resetAll()
  useSettingsStore.getState().resetSettings()
  removePersisted(...ALL_STORAGE_KEYS)
}
