/**
 * Minimal ambient types for the W3C Web Model Context API (`document.modelContext`).
 *
 * Chrome only ships this behind a flag / origin trial, and `@mcp-b/webmcp-polyfill`
 * installs it at runtime without shipping types, so we declare just the surface
 * NetForge actually uses here.
 */

interface WebMCPToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>
  isError?: boolean
  [key: string]: unknown
}

interface WebMCPToolDescriptor {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (args: Record<string, unknown>) => unknown | Promise<unknown>
}

interface WebMCPModelContext {
  registerTool(descriptor: WebMCPToolDescriptor): Promise<unknown>
  getTools?: () => Promise<unknown[]>
}

interface Document {
  modelContext?: WebMCPModelContext
}
