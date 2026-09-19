import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { ClerkProvider, useAuth } from '@clerk/react'
import { setAuthTokenGetter } from '@/lib/authToken'

/**
 * Single seam between the app and Clerk.
 *
 * Clerk's hooks throw when rendered outside <ClerkProvider>, so nothing in the
 * app may call them directly. Components read `useAppAuth()` instead, which
 * works in both modes:
 *  - `clerk`: VITE_CLERK_PUBLISHABLE_KEY is set, real sign-in.
 *  - `local`: no key (local dev / previews). There is nobody to sign in, so the
 *    app opens straight away; `/api/assistant` is only reachable when the
 *    server itself is not enforcing auth (see api/assistant.js).
 */
export interface AppAuth {
  mode: 'clerk' | 'local'
  isSignedIn: boolean
}

const LOCAL_AUTH: AppAuth = { mode: 'local', isSignedIn: true }

const AuthContext = createContext<AppAuth>(LOCAL_AUTH)

export function useAppAuth(): AppAuth {
  return useContext(AuthContext)
}

function ClerkBridge({ children }: { children: ReactNode }) {
  const { isSignedIn, getToken } = useAuth()
  const signedIn = Boolean(isSignedIn)

  useEffect(() => {
    setAuthTokenGetter(signedIn ? () => getToken() : null)
    return () => setAuthTokenGetter(null)
  }, [signedIn, getToken])

  const value = useMemo<AppAuth>(() => ({ mode: 'clerk', isSignedIn: signedIn }), [signedIn])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthProvider({ publishableKey, children }: { publishableKey?: string; children: ReactNode }) {
  if (!publishableKey) {
    return <AuthContext.Provider value={LOCAL_AUTH}>{children}</AuthContext.Provider>
  }
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkBridge>{children}</ClerkBridge>
    </ClerkProvider>
  )
}
