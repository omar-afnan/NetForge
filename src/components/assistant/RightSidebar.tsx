import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { InspectorPanel } from './InspectorPanel'
import { AICopilotPanel } from './AICopilotPanel'

export type SidebarMode = 'inspector' | 'copilot'

interface RightSidebarProps {
  defaultMode?: SidebarMode
  /** Optional close handler - when provided, an "X" button appears in the header. */
  onClose?: () => void
}

export function RightSidebar({ defaultMode = 'inspector', onClose }: RightSidebarProps) {
  const [mode, setMode] = useState<SidebarMode>(defaultMode)

  const handleModeChange = useCallback((next: SidebarMode) => {
    setMode(next)
  }, [])

  return (
    <div className="right-sidebar">
      <div className="right-sidebar-header">
        <div className="right-sidebar-tabs" role="tablist" aria-label="Sidebar mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'inspector'}
            className={`right-sidebar-tab${mode === 'inspector' ? ' active' : ''}`}
            onClick={() => handleModeChange('inspector')}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Inspector
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'copilot'}
            className={`right-sidebar-tab${mode === 'copilot' ? ' active' : ''}`}
            onClick={() => handleModeChange('copilot')}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
              <circle cx="7.5" cy="14.5" r="1.5" />
              <circle cx="16.5" cy="14.5" r="1.5" />
            </svg>
            AI Copilot
          </button>
        </div>
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
        <div className="right-sidebar-mode-indicator" data-mode={mode} />
      </div>

      <div className="right-sidebar-body">
        {mode === 'inspector' && <InspectorPanel />}
        {mode === 'copilot' && <AICopilotPanel />}
      </div>
    </div>
  )
}
