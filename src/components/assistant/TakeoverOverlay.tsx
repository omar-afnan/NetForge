import { useEffect, useRef, useState } from 'react'
import { useCopilotStore } from '@/store/copilotStore'
import { useUIStore } from '@/store/uiStore'

const CHAR_MS = 18

/**
 * Live "AI is solving the lab" overlay, docked over the real topology canvas —
 * not a fake screen. Shows the takeover feed while the AI works, typewrites a
 * summary when solved, plays the completion moment, then returns to the lab
 * library (only after validation passed — the driver only reaches these
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
  const setTakeoverPhase = useCopilotStore((s) => s.setTakeoverPhase)
  const stopLabAssist = useCopilotStore((s) => s.stopLabAssist)

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

  // Completion moment → "Returning to Lab Library..." → redirect.
  useEffect(() => {
    if (phase !== 'complete') return
    setShowReturn(false)
    const t1 = window.setTimeout(() => setShowReturn(true), 1400)
    const t2 = window.setTimeout(() => {
      useUIStore.getState().setActiveView('labs')
      stopLabAssist()
    }, 3400)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [phase, stopLabAssist])

  if (!visible) return null

  return (
    <div className="takeover-overlay">
      <div className="takeover-panel">
        <div className="takeover-title">
          <span className="takeover-bot">🤖</span> AI TAKEOVER
          {phase === 'working' && <span className="takeover-badge">WORKING…</span>}
          {phase === 'complete' && <span className="takeover-badge takeover-badge-ok">DONE</span>}
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
          <div className="takeover-complete">
            <div className="takeover-sparkles">✨ ⭐ ✨</div>
            <div className="takeover-complete-title">LAB COMPLETED</div>
            <div className="takeover-complete-sub">AI successfully solved the networking problem.</div>
            {showReturn && <div className="takeover-return">Returning to Lab Library…</div>}
          </div>
        )}
      </div>
    </div>
  )
}