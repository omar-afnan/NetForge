import { Activity, Zap, Shield, Globe, ArrowRight } from 'lucide-react'
import { SignInButton, SignUpButton } from '@clerk/react'

export function LandingPage() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--bg-root)]">
      <div className="flex flex-1 flex-col justify-center px-12 lg:px-20">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border border-[var(--border-bright)] bg-[var(--bg-elevated)]">
            <Activity className="h-5 w-5 text-[var(--accent-link)]" strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-lg font-bold tracking-wider text-[var(--text-primary)]">NETFORGE</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--accent-link)]">
              A network that agents can actually debug.
            </div>
          </div>
        </div>

        <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-[var(--text-primary)] lg:text-5xl">
          Agent-native network troubleshooting,{' '}
          <span className="text-[var(--accent-link)]">live.</span>
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--text-secondary)]">
          NetForge is a network troubleshooting laboratory where humans and AI agents collaborate
          to inspect, diagnose, explain, repair, and verify simulated network problems  through
          real, structured tool calls.
        </p>

        <div className="mt-8 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              icon: Globe,
              title: 'Live Topology',
              desc: 'Interactive network maps with real device state, links, and routing.',
            },
            {
              icon: Zap,
              title: 'Real Diagnostics',
              desc: 'Ping, traceroute, ARP, and routing analysis that compute from actual simulator state.',
            },
            {
              icon: Shield,
              title: 'Human-in-the-loop',
              desc: 'Agents propose fixes, humans approve. No silent network changes.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="panel p-4"
            >
              <item.icon className="mb-2 h-5 w-5 text-[var(--accent-link)]" strokeWidth={1.5} />
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                {item.title}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-center gap-6 text-[11px] text-[var(--text-dim)]">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-up)]" />
            WebMCP-powered
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-link)]" />
            React + TypeScript
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-amber)]" />
            Built for OpenAI / WebMCP Competition
          </span>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:hidden">
          <SignUpButton mode="modal">
            <button className="flex w-full items-center justify-center gap-2 border border-[rgba(46,200,240,0.4)] bg-[rgba(46,200,240,0.12)] px-4 py-3 text-sm font-semibold text-[var(--accent-link)] transition-all hover:border-[var(--accent-link)] hover:bg-[rgba(46,200,240,0.2)]">
              Create Account
              <ArrowRight className="h-4 w-4" />
            </button>
          </SignUpButton>

          <SignInButton mode="modal">
            <button className="flex w-full items-center justify-center gap-2 border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] transition-all hover:border-[var(--border-bright)] hover:text-[var(--text-primary)]">
              Sign In
            </button>
          </SignInButton>
        </div>
      </div>

      <div className="hidden w-80 shrink-0 flex-col border-l border-[var(--border)] bg-[var(--bg-panel)] p-6 lg:flex">
        <div className="panel-header -mx-6 -mt-6 mb-6 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-6 py-3 text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
          Get Started
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Ready to debug networks with AI?
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
            Create an account to access labs, run diagnostics, and let an agent help you
            troubleshoot real network failures.
          </p>
        </div>

        <div className="space-y-3">
          <SignUpButton mode="modal">
            <button className="flex w-full items-center justify-center gap-2 border border-[rgba(46,200,240,0.4)] bg-[rgba(46,200,240,0.12)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-link)] transition-all hover:border-[var(--accent-link)] hover:bg-[rgba(46,200,240,0.2)]">
              Create Account
              <ArrowRight className="h-4 w-4" />
            </button>
          </SignUpButton>

          <SignInButton mode="modal">
            <button className="flex w-full items-center justify-center gap-2 border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-all hover:border-[var(--border-bright)] hover:text-[var(--text-primary)]">
              Sign In
            </button>
          </SignInButton>

          <p className="text-center text-[10px] text-[var(--text-dim)]">
            By signing up, you agree to our Terms and Privacy Policy.
          </p>
        </div>

        <div className="mt-auto pt-8">
          <div className="border-t border-[var(--border)] pt-4">
            <div className="mb-2 text-[9px] uppercase tracking-widest text-[var(--text-dim)]">
              What you can do
            </div>
            <ul className="space-y-2 text-[11px] text-[var(--text-secondary)]">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-[var(--status-up)]" />
                Inspect live network topology
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-[var(--status-up)]" />
                Run ping, traceroute, ARP, and routing tools
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-[var(--status-up)]" />
                Let NetOps Copilot diagnose issues via WebMCP
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-[var(--status-up)]" />
                Approve fixes before they touch the network
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-[var(--status-up)]" />
                Explore challenge labs like Missing Route, ARP Failure, and more
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
