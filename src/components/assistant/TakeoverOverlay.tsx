import { useEffect, useRef, useState } from 'react'
import { useCopilotStore } from '@/store/copilotStore'
import { useUIStore } from '@/store/uiStore'

const CHAR_MS = 18

/**
 * Live "AI is solving the lab" overlay, docked over the real topology canvas -
 * not a fake screen. Shows the takeover feed while the AI works, typewrites a
 * summary when solved, plays the completion moment, then returns to the lab
 * library (only after validation passed - the driver only reaches these
 * phases on success).
 */
function TypedLine({ text }: { text: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          window.clearInterval(t)
          return v
        }
        return v + 1
      })
    }, 22)
    return () => window.clearInterval(t)
  }, [text])
  return <>{text.slice(0, n)}</>
}

export function TakeoverOverlay() {
  const phase = useCopilotStore((s) => s.labAssist.phase)
  const feed = useCopilotStore((s) => s.labAssist.feed)
  const summary = useCopilotStore((s) => s.labAssist.summary)
  const outcome = useCopilotStore((s) => s.labAssist.outcome)
  const setTakeoverPhase = useCopilotStore((s) => s.setTakeoverPhase)
  const stopLabAssist = useCopilotStore((s) => s.stopLabAssist)

  // Only a genuine, fully-verified solve celebrates and returns to the Library.
  // A partial run resolves honestly (amber, routes to Issues) instead.
  const muted = outcome === 'partial'
  const finalScreen =
    outcome === 'partial'
      ? {
          badge: 'INCOMPLETE',
          badgeOk: false,
          sparkles: '— · —',
          title: 'PARTIALLY SOLVED',
          sub: 'Some connectivity tests are still failing. Open the Issues workspace to finish up.',
          returnText: 'Returning to the Issues workspace…',
          view: 'issues' as const,
        }
      : outcome === 'noop'
        ? {
            badge: 'NO FAULTS',
            badgeOk: true,
            sparkles: '✓',
            title: 'NOTHING TO FIX',
            sub: 'This is the baseline sandbox — every path is already healthy.',
            returnText: 'Returning to the topology…',
            view: 'topology' as const,
          }
        : {
            badge: 'DONE',
            badgeOk: true,
            sparkles: '✨ ⭐ ✨',
            title: 'LAB COMPLETED',
            sub: 'AI successfully solved the networking problem.',
            returnText: 'Returning to Lab Library…',
            view: 'labs' as const,
          }

  const [typed, setTyped] = useState('')
  const [showReturn, setShowReturn] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)

  const visible = phase !== 'idle'

  // Auto-scroll the feed as lines arrive.
  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [feed])

  // Typewriter the summary during the 'summary' phase.
  useEffect(() => {
    if (phase !== 'summary' || !summary) return
    setTyped('')
    let i = 0
    const timer = window.setInterval(() => {
      i += 1
      setTyped(summary.slice(0, i))
      if (i >= summary.length) {
        window.clearInterval(timer)
        window.setTimeout(() => setTakeoverPhase('complete'), 900)
      }
    }, CHAR_MS)
    return () => window.clearInterval(timer)
  }, [phase, summary, setTakeoverPhase])

  // Completion moment → "Returning…" → redirect (target depends on outcome).
  useEffect(() => {
    if (phase !== 'complete') return
    setShowReturn(false)
    const t1 = window.setTimeout(() => setShowReturn(true), 1400)
    const t2 = window.setTimeout(() => {
      useUIStore.getState().setActiveView(finalScreen.view)
      stopLabAssist()
    }, 3400)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [phase, stopLabAssist, finalScreen.view])

  if (!visible) return null

  return (
    <div className="takeover-overlay">
      <div className="takeover-panel">
        <div className="takeover-title">
          <span className="takeover-bot">🤖</span> AI TAKEOVER
          {phase === 'working' && <span className="takeover-badge">WORKING…</span>}
          {phase === 'complete' && (
            <span className={`takeover-badge${finalScreen.badgeOk ? ' takeover-badge-ok' : ''}`}>
              {finalScreen.badge}
            </span>
          )}
        </div>

        {phase === 'working' && (
          <div ref={feedRef} className="takeover-feed font-data">
            {feed.map((l) => (
              <div key={l.id} className={`takeover-line takeover-${l.tone}`}>
                {l.tone === 'cmd' ? <TypedLine text={l.text} /> : l.text}
              </div>
            ))}
            <div className="takeover-caret" />
          </div>
        )}

        {(phase === 'summary' || phase === 'complete') && summary && (
          <div className="takeover-feed font-data takeover-summary">
            <pre className="takeover-summary-text">
              {phase === 'complete' ? summary : typed}
              {phase === 'summary' && <span className="takeover-caret" />}
            </pre>
          </div>
        )}

        {phase === 'complete' && (
          <div className={`takeover-complete${muted ? ' takeover-complete-muted' : ''}`}>
            <div className="takeover-sparkles">{finalScreen.sparkles}</div>
            <div className="takeover-complete-title">{finalScreen.title}</div>
            <div className="takeover-complete-sub">{finalScreen.sub}</div>
            {showReturn && <div className="takeover-return">{finalScreen.returnText}</div>}
          </div>
        )}
      </div>
    </div>
  )
}