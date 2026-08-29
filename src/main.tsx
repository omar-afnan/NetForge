import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {(() => {
      const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
      if (clerkKey) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { ClerkProvider } = require('@clerk/react')
        return <ClerkProvider publishableKey={clerkKey}><App /></ClerkProvider>
      }
      return <App />
    })()}
  </StrictMode>,
)