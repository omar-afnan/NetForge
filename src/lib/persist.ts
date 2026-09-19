/**
 * Versioned, failure-tolerant localStorage persistence.
 *
 * On disk every store is `{ v: <schema version>, data: <payload> }`. Reads never
 * throw: malformed JSON, a schema from the future, a payload that fails its
 * store's sanitizer, or storage being unavailable (private mode, blocked site
 * data, quota) all resolve to `null`, and the store starts from its defaults.
 *
 * Data written before versioning existed (the bare payload) is read as version
 * 0 and passed through the same sanitizer, so nobody's progress is lost.
 *
 * Bump a store's version when its persisted shape changes incompatibly and
 * handle the older number in that store's `sanitize`.
 */

export type Sanitizer<T> = (data: unknown, storedVersion: number) => T | null

interface Envelope {
  v: number
  data: unknown
}

function isEnvelope(value: unknown): value is Envelope {
  return isRecord(value) && typeof value.v === 'number' && 'data' in value && Object.keys(value).length === 2
}

export function readPersisted<T>(key: string, version: number, sanitize: Sanitizer<T>): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    const storedVersion = isEnvelope(parsed) ? parsed.v : 0
    if (storedVersion > version) return null // written by a newer build: don't guess
    const payload = isEnvelope(parsed) ? parsed.data : parsed
    return sanitize(payload, storedVersion)
  } catch {
    return null
  }
}

/** Returns false when the write failed (quota / storage unavailable). */
export function writePersisted(key: string, version: number, data: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify({ v: version, data } satisfies Envelope))
    return true
  } catch {
    return false
  }
}

export function removePersisted(...keys: string[]): void {
  for (const key of keys) {
    try {
      localStorage.removeItem(key)
    } catch {
      // storage unavailable — nothing to clean up
    }
  }
}

/* ── tiny validators shared by the store sanitizers ─────────────────────── */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function str(value: unknown, fallback: string, maxLen = 200): string {
  return typeof value === 'string' ? value.slice(0, maxLen) : fallback
}

export function optStr(value: unknown, maxLen = 200): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, maxLen) : undefined
}

export function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

export function nonNegInt(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback
}

export function finiteNum(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
