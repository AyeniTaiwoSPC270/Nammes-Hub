import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { formatBadge, groupInboxItems, relativeTime, validateAnnouncement } from '../../lib/adminInbox'
import Badge from '../ui/Badge'
import {
  useAdminInboxQuery,
  useMarkInboxSeenMutation,
  usePostAnnouncementMutation,
} from '../../data/adminInbox'

// Rendered by Admin.jsx and by AdminLayout.jsx, so every /admin/* page has the bell and no public
// page does. Opening the panel is the "I have looked" gesture: it marks every category seen and
// invalidates the query, while the list keeps the items it already fetched so the admin can still
// read what was new.
export default function AdminNotificationBell() {
  const { user } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [composing, setComposing] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const ref = useRef(null)

  const inboxQuery = useAdminInboxQuery(Boolean(user?.id))
  const markSeen = useMarkInboxSeenMutation(user?.id)
  const postAnnouncement = usePostAnnouncementMutation()

  const data = inboxQuery.data
  const sections = groupInboxItems(data?.items ?? [], data?.categories ?? [])
  const badge = formatBadge(data?.unread ?? 0)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function openPanel() {
    setOpen(true)
    // Refetch first so a panel opened minutes after the last poll is not stale; marking is
    // independent of that answer because it stamps "now" for every category.
    inboxQuery.refetch()
    markSeen.mutate()
  }

  function togglePanel() {
    if (open) {
      setOpen(false)
      return
    }
    openPanel()
  }

  function submitAnnouncement(event) {
    event.preventDefault()
    const problem = validateAnnouncement({ title, body })
    if (problem) {
      toast.error(problem)
      return
    }
    postAnnouncement.mutate(
      { title, body, userId: user?.id },
      {
        onSuccess: () => {
          setTitle('')
          setBody('')
          setComposing(false)
          toast.success('Announcement posted')
        },
        onError: (error) => toast.error(error.message || 'The announcement was not posted'),
      }
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={togglePanel}
        aria-expanded={open}
        aria-label="Admin notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface text-ink-muted transition-colors hover:bg-surface-low hover:text-ink-900"
      >
        <span className="material-symbols-outlined text-xl">notifications</span>
        {badge && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Admin notifications"
          className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-hairline bg-surface shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <h2 className="text-sm font-bold text-ink-900">Notifications</h2>
            <button
              type="button"
              onClick={() => markSeen.mutate()}
              className="flex items-center gap-1 text-xs font-semibold text-brand transition-colors hover:text-orange-500"
            >
              <span className="material-symbols-outlined text-sm">done_all</span>
              Mark all read
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {inboxQuery.isPending ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">Loading…</p>
            ) : inboxQuery.isError ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">
                Could not load notifications.
              </p>
            ) : sections.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">Nothing new.</p>
            ) : (
              sections.map((section) => (
                <section key={section.key}>
                  <div className="flex items-center justify-between gap-2 bg-surface-low px-4 py-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[.05em] text-ink-muted">
                      <span className="material-symbols-outlined text-sm">{section.icon}</span>
                      {section.label}
                    </span>
                    {section.outstanding > 0 && (
                      <Badge tone="restricted">{section.outstanding} pending</Badge>
                    )}
                  </div>
                  {section.items.length === 0 ? (
                    <Link
                      to={section.href}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3 text-sm font-semibold text-brand no-underline hover:bg-surface-low"
                    >
                      {section.description} — open {section.label.toLowerCase()}
                    </Link>
                  ) : (
                    <ul className="divide-y divide-hairline">
                      {section.items.map((item) => (
                        <li key={item.id}>
                          <Link
                            to={section.href}
                            onClick={() => setOpen(false)}
                            className="block px-4 py-2.5 no-underline transition-colors hover:bg-surface-low"
                          >
                            <p className="truncate text-sm font-semibold text-ink-900">{item.title}</p>
                            <p className="line-clamp-2 text-xs text-ink-muted">{item.detail}</p>
                            <p className="mt-0.5 text-[11px] text-ink-muted">
                              {relativeTime(item.createdAt)}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))
            )}
          </div>

          <div className="border-t border-hairline px-4 py-3">
            {composing ? (
              <form onSubmit={submitAnnouncement} className="flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-muted">Title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={120}
                    required
                    className="rounded-md border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-muted">Announcement</span>
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    maxLength={2000}
                    required
                    rows={3}
                    className="rounded-md border border-hairline bg-surface px-2 py-1.5 text-sm text-ink-900"
                  />
                </label>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setComposing(false)}
                    className="text-xs font-semibold text-ink-muted hover:text-ink-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={postAnnouncement.isPending}
                    className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {postAnnouncement.isPending ? 'Posting…' : 'Post'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setComposing(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-brand transition-colors hover:text-orange-500"
              >
                <span className="material-symbols-outlined text-sm">campaign</span>
                Post announcement
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
