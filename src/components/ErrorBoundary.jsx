import { Component } from 'react'
import ErrorState from './ui/ErrorState'
import Offline from '../pages/Offline'
import { reportError } from '../lib/errorTracking'
import { useOnlineStatus } from '../lib/useOnlineStatus'

// Reaching a page the browser has never fetched means downloading its chunk, and lazyRetry gives up after
// a couple of attempts. When that happens with no connection there is nothing to show but the offline
// screen, so it replaces the generic message here. Only a link that actually failed counts: a slow one is
// left alone, because the chunk may still arrive.
class Boundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info)
    reportError(error, { componentStack: info?.componentStack })
  }

  render() {
    const { hasError } = this.state
    const { status, retry } = this.props

    if (hasError) {
      if (status === 'offline') {
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
