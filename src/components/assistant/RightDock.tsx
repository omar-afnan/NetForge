import { DeviceInspector } from '@/components/devices/DeviceInspector'
import { AssistantPanel } from './AssistantPanel'

/**
 * The redesigned right sidebar: device information (existing component,
 * untouched) on top, AI Lab Assistant below — 50/50 height split with
 * independent scrolling per section.
 */
export function RightDock() {
  return (
    <div className="right-dock">
      <section className="right-dock-top" aria-label="Device information">
        <DeviceInspector />
      </section>
      <div className="right-dock-divider" role="separator" />
      <section className="right-dock-bottom" aria-label="AI lab assistant">
        <AssistantPanel />
      </section>
    </div>
  )
}
