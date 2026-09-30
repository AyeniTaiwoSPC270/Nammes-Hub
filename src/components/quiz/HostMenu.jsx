import { createContext, useContext, useState } from 'react'
import { Link } from 'react-router-dom'

// The host's game menu, in the corner of every host screen: end the game early, delete it, or leave for the admin area.
// Both "end" and "delete" ask first (nothing is undone by accident). The host screen provides what the buttons do.

const HostMenuContext = createContext(null)
export const HostMenuProvider = HostMenuContext.Provider

export function HostMenu() {
  const menu = useContext(HostMenuContext)
  const [open, setOpen] = useState(false)
  const [asking, setAsking] = useState(null) // 'end' or 'delete'
  if (!menu) return null

  const close = () => {
    setOpen(false)
    setAsking(null)
  }
  const item = 'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left font-semibold hover:bg-surface-low'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label="Game menu"
        title="Game menu"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface text-ink-900 hover:bg-surface-low"
      >
        <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-40 w-72 rounded-2xl border border-hairline bg-surface p-2 shadow-xl">
          {asking ? (
            <div className="flex flex-col gap-3 p-2" role="alert">
              <p className="font-semibold">
                {asking === 'end'
                  ? 'End the game now? Everyone sees the final results, and the report keeps what was played.'
                  : 'Delete this game and everything recorded for it? This cannot be undone.'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={menu.busy}
                  onClick={() => {
                    const action = asking === 'end' ? menu.onEnd : menu.onDelete
                    close()
                    action()
                  }}
                  className={`min-h-11 flex-1 rounded-xl px-4 font-bold text-white ${asking === 'end' ? 'bg-orange-500' : 'bg-red-600'}`}
                >
                  {asking === 'end' ? 'Yes, end it' : 'Yes, delete'}
                </button>
                <button type="button" onClick={() => setAsking(null)} className="min-h-11 flex-1 rounded-xl border border-hairline px-4 font-bold">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {menu.canEnd && (
                <button type="button" role="menuitem" onClick={() => setAsking('end')} className={item}>
                  <span className="material-symbols-outlined" aria-hidden="true">flag</span>
                  End game now
                </button>
              )}
              <button type="button" role="menuitem" onClick={() => setAsking('delete')} className={`${item} text-red-600`}>
                <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                {menu.state === 'lobby' ? 'Cancel and delete this game' : 'Delete this game'}
              </button>
              <Link to="/admin/quizzes" role="menuitem" className={`${item} no-underline`}>
                <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                Back to admin
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
