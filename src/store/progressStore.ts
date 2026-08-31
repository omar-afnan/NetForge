import { create } from 'zustand'

const STORAGE_KEY = 'netforge-learn-progress'

export interface LearnProgress {
  /** Completed lesson keys: `${moduleId}/${lessonId}`. */
  lessons: Record<string, { completedAt: string }>
  toggleLesson: (moduleId: string, lessonId: string) => void
  isLessonDone: (moduleId: string, lessonId: string) => boolean
  completedCount: (moduleLessonKeys: string[]) => number
  resetProgress: () => void
}

function load(): Record<string, { completedAt: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw)
    return data.lessons ?? {}
  } catch {
    return {}
  }
}

function persist(lessons: Record<string, { completedAt: string }>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lessons }))
  } catch {
    // ignore quota errors
  }
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
