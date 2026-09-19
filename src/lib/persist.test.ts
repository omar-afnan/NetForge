import { afterEach, describe, expect, it, vi } from 'vitest'
import { readPersisted, removePersisted, writePersisted, isRecord } from './persist'

const KEY = 'test-key'
const sanitize = (d: unknown) => (isRecord(d) && typeof d.n === 'number' ? { n: d.n } : null)

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('persist', () => {
  it('round-trips a versioned envelope', () => {
    expect(writePersisted(KEY, 2, { n: 5 })).toBe(true)
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ v: 2, data: { n: 5 } })
    expect(readPersisted(KEY, 2, sanitize)).toEqual({ n: 5 })
  })

  it('reads legacy unversioned payloads as version 0', () => {
    localStorage.setItem(KEY, JSON.stringify({ n: 9 }))
    const seen: number[] = []
    const result = readPersisted(KEY, 1, (d, v) => (seen.push(v), sanitize(d)))
    expect(result).toEqual({ n: 9 })
    expect(seen).toEqual([0])
  })

  it('ignores data written by a newer schema instead of guessing', () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 9, data: { n: 1 } }))
    expect(readPersisted(KEY, 1, sanitize)).toBeNull()
  })

  it.each(['{not json', '"a string"', '123', 'null', '[]', '{"v":1}', ''])('survives malformed payload %j', (raw) => {
    localStorage.setItem(KEY, raw)
    expect(readPersisted(KEY, 1, sanitize)).toBeNull()
  })

  it('returns null when the sanitizer throws', () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, data: {} }))
    expect(
      readPersisted(KEY, 1, () => {
        throw new Error('boom')
      }),
    ).toBeNull()
  })

  it('never throws when storage is unavailable (private mode / blocked)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(readPersisted(KEY, 1, sanitize)).toBeNull()
    expect(writePersisted(KEY, 1, { n: 1 })).toBe(false)
    expect(() => removePersisted(KEY)).not.toThrow()
  })
})
