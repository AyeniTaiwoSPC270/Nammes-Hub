import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'
import { ThemeProvider } from './lib/ThemeContext.jsx'
import { HolidayThemeProvider } from './lib/HolidayThemeProvider.jsx'
import { ToastProvider } from './lib/ToastContext.jsx'
import { TourProvider } from './lib/TourContext.jsx'
import { ChromeProvider } from './lib/ChromeContext.jsx'
import { queryClient } from './lib/queryClient.js'
import { notifyIfNewDeploy } from './lib/appUpdate.js'
import { initErrorTracking } from './lib/errorTracking.js'

initErrorTracking()

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  notifyIfNewDeploy()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          {/* Inside ThemeProvider on purpose: the holiday overlay re-reads light/dark and re-writes its
              custom properties when the reader toggles. */}
          <HolidayThemeProvider>
            <AuthProvider>
              <ToastProvider>
                <TourProvider>
                  <ChromeProvider>
                    <App />
                  </ChromeProvider>
                </TourProvider>
              </ToastProvider>
            </AuthProvider>
          </HolidayThemeProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
