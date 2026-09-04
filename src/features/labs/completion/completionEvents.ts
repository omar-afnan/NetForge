import { TypedEmitter } from '@/lib/typedEmitter'

/**
 * A single lab-completion event. Created once per completion and consumed exactly once.
 */
export interface LabCompletionEvent {
  labId: string
  eventId: string
  completedAt: string
  aiAssisted?: boolean
}

type Events = {
  labCompleted: (event: LabCompletionEvent) => void
}

/**
 * Centralized, ephemeral completion-event bus.
 *
 * Unlike reading `completedLabs` from the network store (which reflects all
 * historical completions), this bus fires a **single new event** only at the
 * moment a lab transitions from incomplete → complete during the current
 * interaction. The event is consumed once and never replays.
 *
 * This prevents the "Lab Complete popup appearing on the Lab Library
 * after navigating away / reloading" bug.
 */
class LabCompletionService {
  private emitter = new TypedEmitter<Events>()
  private consumed = new Set<string>()

  /** Called by the network store when a lab freshly completes. */
  fire(labId: string, completedAt: string, aiAssisted?: boolean): void {
    const eventId = `${labId}@${completedAt}`
    // Guard against re-firing the same logical event (e.g. if completeLab is called twice).
    if (this.consumed.has(eventId)) return
    this.emitter.emit('labCompleted', { labId, eventId, completedAt, aiAssisted })
  }

  /** Subscribe to completion events. Returns the most recent unconsumed event, or null. */
  subscribe(callback: (event: LabCompletionEvent) => void): () => void {
    return this.emitter.on('labCompleted', callback)
  }
}

export const labCompletionService = new LabCompletionService()