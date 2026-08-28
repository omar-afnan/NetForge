export interface WebMCPToolResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
