/**
 * Minimal typed EventEmitter. Avoids pulling in `mitt` or `EventEmitter3`
 * just for a single internal event channel.
 */
export class TypedEmitter<E extends Record<string, (...args: any[]) => void>> {
  private listeners: Map<keyof E, Set<E[keyof E]>> = new Map()

  on<K extends keyof E>(event: K, cb: E[K]): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(cb)
    return () => set!.delete(cb)
  }

  emit<K extends keyof E>(event: K, ...args: Parameters<E[K]>): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const cb of [...set]) cb(...args)
  }
}