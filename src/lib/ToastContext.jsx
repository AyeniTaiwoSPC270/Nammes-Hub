import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Toast from '../components/ui/Toast'

const ToastContext = createContext(undefined)
let nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const push = useCallback((tone, message) => {
    const id = ++nextId
    setToasts((prev) => [...prev, { id, tone, message }])
    timers.current[id] = setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  const value = {
    success: (message) => push('success', message),
    error: (message) => push('danger', message),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((t) => (
          <Toast key={t.id} tone={t.tone} onDismiss={() => dismiss(t.id)}>
            {t.message}
          </Toast>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
