import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import { registerNetForgeWebMCP } from './webmcp/register'

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// Expose NetForge as WebMCP tools to any AI agent driving the browser.
// Non-blocking and failure-tolerant — never let it break app startup.
void registerNetForgeWebMCP().catch((err) => console.warn('[webmcp] registration failed:', err))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clerkKey ? <ClerkProvider publishableKey={clerkKey}><App /></ClerkProvider> : <App />}
  </StrictMode>,
)