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
    // With storage blocked there is nothing that survives a reload to guard against a loop, and a plain
    // variable would not help either because the reload restarts the script. So skip the automatic reload
    // entirely; the generic error screen still offers a Reload button for the user to press.
    return
  }
  window.location.reload()
}

class Boundary extends Component {
  state = { hasError: false, sawOutage: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info)
    reportError(error, { componentStack: info?.componentStack })
  }

  componentDidUpdate(prevProps) {
    const { status } = this.props
    const { hasError, sawOutage } = this.state
    if (!hasError) return
    if (!sawOutage && (status === 'offline' || status === 'checking')) {
      this.setState({ sawOutage: true })
      return
    }
    if (sawOutage && prevProps.status !== 'online' && status === 'online') reloadOnce()
  }

  render() {
    const { hasError, sawOutage } = this.state
    const { status, retry } = this.props

    if (hasError) {
      // Once an outage has been seen, the offline screen stays up through recovery. Its 'online' state is
      // a Reload button, which also covers the case where the automatic reload is held back by the cooldown.
      if (status === 'offline' || status === 'checking' || (sawOutage && status === 'online')) {
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
