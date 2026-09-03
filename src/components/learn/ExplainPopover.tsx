import { useEffect, useId, useRef, useState } from 'react'
import { Lightbulb, X } from 'lucide-react'
import { getExplainContent } from '@/data/explainers/networkObjects'

/**
 * A small "Explain this" affordance. Renders a 💡 trigger inline; clicking it
 * opens a token-styled popover with a short, plain explanation of a networking
 * object. Dismisses on outside-click or Esc. No portal / no library - the
 * popover is absolutely positioned relative to the trigger.
 */
export function ExplainPopover({
  objectKey,
  label,
  className = '',
}: {
  objectKey: string
  /** Optional visible text before the bulb (e.g. the term itself). */
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const panelId = useId()
  const content = getExplainContent(objectKey)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  if (!content) return label ? <span className={className}>{label}</span> : null

  return (
    <span ref={wrapRef} className={`relative inline-flex items-center gap-1 ${className}`}>
      {label && <span>{label}</span>}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center border transition-colors ${
          open
            ? 'border-[var(--accent-link)] text-[var(--accent-link)]'
            : 'border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-link)] hover:text-[var(--accent-link)]'
        }`}
        title={`Explain: ${content.title}`}
      >
        <Lightbulb className="h-2.5 w-2.5" strokeWidth={2} />
      </button>

      {open && (
        <span
          id={panelId}
          role="dialog"
          className="absolute left-0 top-full z-30 mt-1.5 block w-72 border border-[var(--border-bright)] bg-[var(--bg-elevated)] p-3 text-left shadow-[0_8px_28px_-8px_rgba(0,0,0,0.7)]"
        >
          <span className="mb-1 flex items-center justify-between">
            <span className="font-data text-[11px] font-bold uppercase tracking-widest text-[var(--accent-link)]">
              {content.title}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              aria-label="Close"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
          {content.body.map((p, i) => (
            <span key={i} className="mt-1 block text-[11px] leading-relaxed text-[var(--text-secondary)]">
              {p}
            </span>
          ))}
          {content.facts && (
            <span className="mt-2 block border-t border-[var(--border)] pt-1.5">
              {content.facts.map(([k, v]) => (
                <span key={k} className="flex justify-between font-data text-[10px] text-[var(--text-dim)]">
                  <span>{k}</span>
                  <span className="text-[var(--text-primary)]">{v}</span>
                </span>
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
