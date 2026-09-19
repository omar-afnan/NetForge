import { create } from 'zustand'
import { isRecord, readPersisted, str, writePersisted } from '@/lib/persist'

const STORAGE_KEY = 'netforge-learn-progress'
const SCHEMA_VERSION = 1

export interface LearnProgress {
  /** Completed lesson keys: `${moduleId}/${lessonId}`. */
  lessons: Record<string, { completedAt: string }>
  toggleLesson: (moduleId: string, lessonId: string) => void
  isLessonDone: (moduleId: string, lessonId: string) => boolean
  completedCount: (moduleLessonKeys: string[]) => number
  resetProgress: () => void
}

/** Legacy (unversioned) payloads were `{ lessons }`; versioned ones store the same object. */
export function sanitizeLessons(raw: unknown): Record<string, { completedAt: string }> | null {
  if (!isRecord(raw) || !isRecord(raw.lessons)) return null
  const out: Record<string, { completedAt: string }> = {}
  for (const [key, entry] of Object.entries(raw.lessons)) {
    if (key.length > 200 || !isRecord(entry)) continue
    out[key] = { completedAt: str(entry.completedAt, '', 40) }
  }
  return out
}

function load(): Record<string, { completedAt: string }> {
  return readPersisted(STORAGE_KEY, SCHEMA_VERSION, sanitizeLessons) ?? {}
}

function persist(lessons: Record<string, { completedAt: string }>) {
  writePersisted(STORAGE_KEY, SCHEMA_VERSION, { lessons })
}

export const useLearnProgress = create<LearnProgress>((set, get) => ({
  lessons: load(),
  toggleLesson: (moduleId, lessonId) =>
    set((state) => {
      const key = `${moduleId}/${lessonId}`
      const lessons = { ...state.lessons }
      if (lessons[key]) {
        delete lessons[key]
      } else {
        lessons[key] = { completedAt: new Date().toISOString() }
      }
      persist(lessons)
      return { lessons }
    }),
  isLessonDone: (moduleId, lessonId) => Boolean(get().lessons[`${moduleId}/${lessonId}`]),
  completedCount: (keys) => keys.filter((k) => get().lessons[k]).length,
  resetProgress: () => {
    persist({})
    set({ lessons: {} })
  },
}))
