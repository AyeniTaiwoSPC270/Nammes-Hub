import { Component } from 'react'
import ErrorState from './ui/ErrorState'
import Offline from '../pages/Offline'
import { reportError } from '../lib/errorTracking'
import { useOnlineStatus } from '../lib/useOnlineStatus'

// A page that failed to load while offline can only be fixed by loading it again, so once the link is back
// the app reloads itself. The cooldown stops a page that keeps failing from reloading in a loop.
const RELOAD_KEY = 'nammes-offline-reload'
const RELOAD_COOLDOWN_MS = 30000

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // Blocked storage only costs us the loop guard; the reload itself is still the right move.
  }
  window.location.reload()
}

class Boundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info)
    reportError(error, { componentStack: info?.componentStack })
  }

  componentDidUpdate(prevProps) {
    const wasDown = prevProps.status === 'offline' || prevProps.status === 'checking'
    if (this.state.hasError && wasDown && this.props.status === 'online') reloadOnce()
  }

  render() {
    const { hasError } = this.state
    const { status, retry } = this.props

    if (hasError) {
      // 'checking' stays on this screen so Try again shows the spinner state instead of dropping to the
      // generic error.
      if (status === 'offline' || status === 'checking') {
        return <Offline status={status} onRetry={retry} />
      }
      return (
        <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
          <ErrorState
            message="The page ran into a problem. Reloading usually fixes it."
            onRetry={() => window.location.reload()}
          />
        </div>
      )
    }
    return this.props.children
  }
}

export default function ErrorBoundary({ children }) {
  const { status, retry } = useOnlineStatus()
  return (
    <Boundary status={status} retry={retry}>
      {children}
    </Boundary>
  )
}
