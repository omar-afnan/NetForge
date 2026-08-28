export function registerWebMCPTools(): void {
  if (typeof navigator === 'undefined' || !('modelContext' in navigator)) {
    console.info('[WebMCP] Browser WebMCP API not available in this environment.')
    return
  }

  // Tool registration will be implemented in Phase 6.
}
