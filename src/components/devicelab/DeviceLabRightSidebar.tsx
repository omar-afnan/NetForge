import { X } from 'lucide-react'
import { AICopilotPanel } from '@/components/assistant/AICopilotPanel'

interface DeviceLabRightSidebarProps {
  onClose?: () => void
}

export function DeviceLabRightSidebar({ onClose }: DeviceLabRightSidebarProps) {
  return (
    <div className="right-sidebar">
      <div className="right-sidebar-header flex items-center gap-2">
        <span className="text-[11px] font-semibold text-[var(--text-primary)]">AI Copilot</span>
        {onClose && (
          <button
            type="button"
            className="ml-auto rounded p-0.5 text-[var(--text-dim)] hover:text-[var(--text-primary)]"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="right-sidebar-body">
        <AICopilotPanel />
      </div>
    </div>
  )
}
