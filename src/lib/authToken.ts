/**
 * Holds the current session-token getter so non-React code (the copilot's
 * fetch layer) can attach `Authorization: Bearer <jwt>` to `/api/assistant`
 * calls. Set by <AuthProvider> when Clerk is active; stays null in local mode.
 */
type TokenGetter = () => Promise<string | null>

let getter: TokenGetter | null = null

export function setAuthTokenGetter(next: TokenGetter | null): void {
  getter = next
}

export async function getAuthToken(): Promise<string | null> {
  if (!getter) return null
  try {
    return await getter()
  } catch {
    return null
  }
}
