import { create } from 'zustand'
import type { Device, NetworkIssue, NetworkLink, ProposedFix } from '@/network/types'

interface NetworkState {
  devices: Device[]
  links: NetworkLink[]
  issues: NetworkIssue[]
  proposedFixes: ProposedFix[]
  setDevices: (devices: Device[]) => void
  setLinks: (links: NetworkLink[]) => void
}

export const useNetworkStore = create<NetworkState>((set) => ({
  devices: [],
  links: [],
  issues: [],
  proposedFixes: [],
  setDevices: (devices) => set({ devices }),
  setLinks: (links) => set({ links }),
}))
