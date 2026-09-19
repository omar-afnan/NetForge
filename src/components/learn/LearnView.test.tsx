import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

vi.mock('@/lib/celebrate', () => ({ celebrateLab: () => {} }))

import { LearnView } from './LearnView'
import { useLearnProgress } from '@/store/progressStore'

// Tell React this environment supports act().
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLElement | null = null

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = container = null
  localStorage.clear()
  useLearnProgress.getState().resetProgress()
})

const click = (el: Element | undefined) => {
  if (!el) throw new Error('element not found')
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}
const button = (re: RegExp) => [...container!.querySelectorAll('button')].find((b) => re.test(b.textContent ?? ''))

describe('LearnView interactive lessons', () => {
  it('opens an interactive lesson (intro -> runner) without a hooks crash, and exits back to the hub', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    act(() => root!.render(createElement(LearnView)))
    click(button(/^4\s*Subnetting/))
    click(button(/Interactive Lesson · Understanding IPv4/))
    // Regression: this render used to throw "Rendered fewer hooks than expected"
    // and blank the entire app because a hook sat below the early return.
    expect(container.textContent).toMatch(/IPv4/)
    expect(container.querySelector('button')).not.toBeNull()

    click(button(/learn|start|begin|walk/i))
    expect(container.querySelectorAll('button').length).toBeGreaterThan(0)
    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/fewer hooks|Rules of Hooks/i)
    errors.mockRestore()
  })
})

describe('lesson completion persistence', () => {
  it('toggling a lesson persists and a fresh store instance restores it; reset clears it', async () => {
    useLearnProgress.getState().toggleLesson('subnetting', 'ipv4-cidr')
    expect(JSON.parse(localStorage.getItem('netforge-learn-progress')!).v).toBe(1)
    vi.resetModules()
    const fresh = (await import('@/store/progressStore')).useLearnProgress
    expect(fresh.getState().isLessonDone('subnetting', 'ipv4-cidr')).toBe(true)
    fresh.getState().resetProgress()
    expect(fresh.getState().isLessonDone('subnetting', 'ipv4-cidr')).toBe(false)
    expect(JSON.parse(localStorage.getItem('netforge-learn-progress')!).data.lessons).toEqual({})
  })
})
