import {
  Monitor,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Terminal,
} from 'lucide-react'
import { starterLab } from '@/data/labs/starterLab'
import { useNetworkStore } from '@/store/networkStore'
import { useSettingsStore } from '@/store/settingsStore'

function SettingSection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  children: React.ReactNode
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="panel-header flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[var(--accent-link)]" strokeWidth={1.75} />
        {title}
      </div>
      <div className="divide-y divide-[var(--border)]">{children}</div>
    </section>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-[var(--text-primary)]">{label}</div>
        {description && (
          <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-dim)]">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 border transition-colors ${
        checked
          ? 'border-[var(--accent-link)] bg-[var(--accent-link)]/20'
          : 'border-[var(--border-bright)] bg-[var(--bg-root)]'
      }`}
    >
      <span
        className={`absolute top-0.5 h-3.5 w-3.5 bg-[var(--text-primary)] transition-transform ${
          checked ? 'left-[18px] bg-[var(--accent-link)]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

export function SettingsView() {
  const settings = useSettingsStore()
  const lab = useNetworkStore((s) => s.lab)
  const devices = useNetworkStore((s) => s.devices)
  const loadLab = useNetworkStore((s) => s.loadLab)

  const hostnames = devices.map((d) => d.hostname).sort()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--accent-link)]" strokeWidth={1.75} />
          Settings
        </span>
        <button
          type="button"
          onClick={() => settings.resetSettings()}
          className="btn-ghost flex items-center gap-1 text-[10px] normal-case tracking-normal"
        >
          <RotateCcw className="h-3 w-3" />
          Reset defaults
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto grid max-w-4xl gap-4">
          <SettingSection title="Display" icon={Monitor}>
            <SettingRow
              label="Topology grid"
              description="Show the coordinate grid behind the network map."
            >
              <Toggle
                label="Toggle topology grid"
                checked={settings.showTopologyGrid}
                onChange={(v) => settings.updateSettings({ showTopologyGrid: v })}
              />
            </SettingRow>
            <SettingRow
              label="Panel glow"
              description="Subtle accent lighting on panels and active navigation."
            >
              <Toggle
                label="Toggle panel glow"
                checked={settings.glowEffects}
                onChange={(v) => settings.updateSettings({ glowEffects: v })}
              />
            </SettingRow>
            <SettingRow
              label="Link pulse"
              description="Animate active links on the topology canvas."
            >
              <Toggle
                label="Toggle link pulse"
                checked={settings.showLinkPulse}
                onChange={(v) => settings.updateSettings({ showLinkPulse: v })}
              />
            </SettingRow>
            <SettingRow
              label="Compact tables"
              description="Reduce row padding in inventory and inspector tables."
            >
              <Toggle
                label="Toggle compact tables"
                checked={settings.compactTables}
                onChange={(v) => settings.updateSettings({ compactTables: v })}
              />
            </SettingRow>
          </SettingSection>

          <SettingSection title="Terminal" icon={Terminal}>
            <SettingRow
              label="Use selected device"
              description="Run commands from the device selected on the topology map."
            >
              <Toggle
                label="Toggle selected device context"
                checked={settings.useSelectedDeviceForTerminal}
                onChange={(v) => settings.updateSettings({ useSelectedDeviceForTerminal: v })}
              />
            </SettingRow>
            <SettingRow
              label="Default context device"
              description="Fallback host when no device is selected."
            >
              <select
                value={settings.defaultTerminalDevice}
                onChange={(e) => settings.updateSettings({ defaultTerminalDevice: e.target.value })}
                disabled={settings.useSelectedDeviceForTerminal}
                className="select-field font-data text-[11px]"
              >
                {hostnames.map((host) => (
                  <option key={host} value={host}>
                    {host}
                  </option>
                ))}
              </select>
            </SettingRow>
          </SettingSection>

          <SettingSection title="Lab Environment" icon={RefreshCw}>
            <SettingRow
              label="Active lab"
              description={`${lab.description} (${devices.length} devices)`}
            >
              <span className="badge badge-cyan font-data">{lab.title}</span>
            </SettingRow>
            <SettingRow
              label="Reload starter lab"
              description="Reset the network to the default competition topology."
            >
              <button
                type="button"
                onClick={() => loadLab(starterLab)}
                className="btn-primary flex items-center gap-1.5 text-[11px]"
              >
                <RefreshCw className="h-3 w-3" />
                Reload
              </button>
            </SettingRow>
          </SettingSection>

          <section className="panel p-4">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)]">About</div>
            <div className="mt-2 font-data text-lg font-semibold text-[var(--text-primary)]">NetForge</div>
            <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
              Agent-native network troubleshooting laboratory. Simulator v0.2
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge">React + Vite</span>
              <span className="badge">IPv4 Simulator</span>
              <span className="badge badge-green">Engine Online</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
