import { UserButton } from '@clerk/react'
import { useAppAuth } from './AuthProvider'

/** Clerk's account button, or nothing in local (no-Clerk) mode. */
export function UserMenu() {
  const { mode } = useAppAuth()
  return mode === 'clerk' ? <UserButton /> : null
}
