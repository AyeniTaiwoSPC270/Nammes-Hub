import { useEffect, useState } from 'react'
import FeedbackModal from './FeedbackModal'
import { useFeedbackFlagQuery } from '../data/feedback'
import { shouldPrompt, markShown, markRated } from '../lib/feedbackStorage'

/**
 * One component, two jobs: a link that opens the rating modal, and — with `auto` — the automatic
 * prompt itself. Both render nothing at all while `feature_flags.feedback` is off, so the switch
 * on the System page hides the entry points and the popup together.
 *
 * The auto prompt waits for the flag query to settle rather than prompting on the optimistic
 * default: this feature ships switched off, and opening a modal on a visitor before we know the
 * switch is on would be the one failure with no way to take back.
 */
export default function FeedbackLauncher({ auto = false, className, children }) {
  const { data: enabled, isFetched } = useFeedbackFlagQuery()
  const [autoOpen, setAutoOpen] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!auto || !isFetched || !enabled) return undefined
    if (shouldPrompt()) {
      markShown()
      setAutoOpen(true)
    }
    return undefined
  }, [auto, isFetched, enabled])

  if (!isFetched || !enabled) return null

  function close() {
    setOpen(false)
    setAutoOpen(false)
  }

  return (
    <>
      {!auto && (
        <button type="button" onClick={() => setOpen(true)} className={className}>
          {children ?? 'Rate the Hub'}
        </button>
      )}
      {(open || autoOpen) && <FeedbackModal onClose={close} onRated={markRated} />}
    </>
  )
}
