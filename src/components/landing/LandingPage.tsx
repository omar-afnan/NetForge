import { ArrowRight, Globe, Shield, Zap } from 'lucide-react'
import { SignInButton, SignUpButton } from '@clerk/react'
import { Button } from '@/components/ui/button'

/**
 * Signature element: the port-light strip. It's the row of link LEDs above a
 * stack of RJ45 jacks — mostly up (green), a couple negotiating (amber), one
 * dead (dark). It's the product's subject rendered literally, and it recurs
 * as the brand mark. Pattern is fixed, not random: this is a specific switch.
 */
const PORTS = ['up', 'up', 'up', 'warn', 'up', 'up', 'down', 'up', 'warn', 'up', 'up', 'up'] as const

function PortStrip({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-end gap-[3px] ${className}`} aria-hidden>
      {PORTS.map((state, i) => (
        <span
          key={i}
          className={state === 'warn' ? 'status-dot-active' : undefined}
          style={{
            width: 4,
            height: state === 'down' ? 8 : 6 + ((i * 7) % 11),
            background:
              state === 'up'
                ? 'var(--status-up)'
                : state === 'warn'
                  ? 'var(--status-warn)'
                  : 'var(--border-bright)',
            boxShadow:
              state === 'down'
                ? 'none'
                : `0 0 6px ${state === 'up' ? 'var(--status-up)' : 'var(--status-warn)'}`,
          }}
        />
      ))}
    </div>
  )
}

const CAPABILITIES = [
  {
    icon: Globe,
    tag: 'topology',
    title: 'Live topology',
    desc: 'Device state, links and routing rendered from the running simulator — not a static diagram.',
  },
  {
    icon: Zap,
    tag: 'diagnostics',
    title: 'Real instruments',
    desc: 'ping · traceroute · arp · show ip route — each computed against actual simulator state.',
  },
  {
    icon: Shield,
    tag: 'control',
    title: 'Human in the loop',
    desc: 'The agent proposes a fix and shows its work. Nothing touches the network until you approve.',
  },
]

export function LandingPage() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--bg-root)] font-[family-name:var(--font-mono)] text-[var(--text-primary)]">
      {/* ── left: the pitch ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-col justify-center overflow-y-auto px-10 py-12 lg:px-20">
        <header className="flex items-center gap-4">
          <PortStrip />
          <div className="h-8 w-px bg-[var(--border)]" />
          <div>
            <div className="text-base font-bold tracking-[0.34em] text-[var(--text-primary)]">
              NET<span className="text-[var(--accent-link)]">·</span>FORGE
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)]">
              NOC console · WebMCP
            </div>
          </div>
        </header>

        <h1 className="mt-10 max-w-2xl text-[2.1rem] font-semibold leading-[1.15] tracking-tight text-[var(--text-primary)] lg:text-[2.75rem]">
          A network that agents
          <br />
          can <span className="text-[var(--accent-link)]">actually</span> debug.
        </h1>

        <p className="mt-6 max-w-xl font-[family-name:var(--font-sans)] text-[15px] leading-relaxed text-[var(--text-secondary)]">
          NetForge is a troubleshooting lab where a person and an AI agent work the same broken
          network — inspecting, diagnosing, repairing and verifying simulated faults through real,
          structured tool calls.
        </p>

        {/* instrument manifest — monospace, reads as a device banner */}
        <dl className="mt-10 grid max-w-2xl gap-x-8 gap-y-4 sm:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, tag, title, desc }) => (
            <div key={tag} className="border-t border-[var(--border)] pt-3">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-[var(--accent-link)]" strokeWidth={1.75} />
                <dt className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
                  {tag}
                </dt>
              </div>
              <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">{title}</div>
              <dd className="mt-1 font-[family-name:var(--font-sans)] text-[12px] leading-relaxed text-[var(--text-secondary)]">
                {desc}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-[var(--text-dim)]">
          <span className="flex items-center gap-1.5">
            <span className="pulse-dot" /> sim online
          </span>
          <span>react + typescript</span>
          <span>webmcp tool surface</span>
          <span>built for the openai / webmcp competition</span>
        </div>

        {/* auth is in the right rail on desktop; inline it on narrow screens */}
        <div className="mt-10 flex flex-col gap-2.5 lg:hidden">
          <SignUpButton mode="modal">
            <Button variant="accent" block>
              Create account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </SignUpButton>
          <SignInButton mode="modal">
            <Button variant="secondary" block>
              Sign in
            </Button>
          </SignInButton>
        </div>
      </div>

      {/* ── right: the login bay ────────────────────────────────── */}
      <aside className="hidden w-[340px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--bg-panel)] lg:flex">
        <div className="panel-header flex items-center justify-between">
          <span>Session · Auth</span>
          <PortStrip className="scale-90 opacity-80" />
        </div>

        <div className="flex flex-1 flex-col p-6">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
            Open a console session
          </h2>
          <p className="mt-2 font-[family-name:var(--font-sans)] text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
            An account gets you the labs, the diagnostic tools, and an agent that can drive them
            alongside you.
          </p>

          <div className="mt-6 space-y-2.5">
            <SignUpButton mode="modal">
              <Button variant="accent" block>
                Create account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </SignUpButton>
            <SignInButton mode="modal">
              <Button variant="secondary" block>
                Sign in
              </Button>
            </SignInButton>
            <p className="pt-1 text-center text-[10px] text-[var(--text-dim)]">
              Creating an account accepts the Terms and Privacy Policy.
            </p>
          </div>

          <div className="mt-auto border-t border-[var(--border)] pt-4">
            <div className="mb-2.5 text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
              In the session
            </div>
            <ul className="space-y-1.5 text-[11.5px] text-[var(--text-secondary)]">
              {[
                'Inspect live topology and device state',
                'Run ping, traceroute, arp and routing checks',
                'Let the copilot diagnose faults over WebMCP',
                'Approve every fix before it lands',
                'Work challenge labs: Missing Route, ARP Failure, and more',
              ].map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 bg-[var(--status-up)]" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  )
}
