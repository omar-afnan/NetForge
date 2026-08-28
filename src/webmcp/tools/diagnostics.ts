import type { WebMCPToolResult } from '../types'
import { useNetworkStore } from '@/store/networkStore'
import { describeFailure } from '@/network/failures'

export function getNetworkIssues(): WebMCPToolResult {
  const { issues, lab, devices, links, failures } = useNetworkStore.getState()
  return {
    success: true,
    data: {
      lab: { id: lab.id, title: lab.title, expectedIssues: lab.issueCount },
      openIssues: issues,
      injectedFaults: (failures ?? []).map((failure) => describeFailure(failure, devices)),
      linkCount: links.length,
    },
  }
}
