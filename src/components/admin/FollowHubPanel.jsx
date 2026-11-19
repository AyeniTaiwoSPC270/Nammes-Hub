import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import FormField from '../ui/FormField'
import { useToast } from '../../lib/ToastContext'
import { saveBlob } from '../../lib/downloadImage'
import { saveCardBlob } from '../../lib/shareCard'
import { followQrTarget, followSharedTarget, normaliseCampaign } from '../../lib/followHub'
import { qrPngDataUrl, qrSvgText, renderFollowCard } from '../../lib/followQr'
import { useFollowScanSummaryQuery } from '../../data/follow'

const SOURCE_LABELS = { qr: 'QR scans', link: 'Shared links' }

// Display names only; an unknown key still renders, so adding a pinned platform or a hub tile never needs
// this map edited for the number to appear at all.
const LINK_LABELS = {
  whatsapp: 'WhatsApp',
  x: 'X',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  newsletter: 'Newsletter',
  news: 'News',
  events: 'Events',
  calendar: 'Calendar',
  quiz: 'Quizzes',
  cbt: 'CBT practice',
  outlines: 'Outlines',
  resources: 'Resources',
  cgpa: 'CGPA calculator',
}

export default function FollowHubPanel() {
  const toast = useToast()
  const [campaign, setCampaign] = useState('')
  const campaignSlug = normaliseCampaign(campaign)
  const target = followQrTarget(window.location.origin, campaignSlug)
  const sharedUrl = followSharedTarget(window.location.origin, campaignSlug)
  const fileSuffix = campaignSlug ? `-${campaignSlug}` : ''
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [busy, setBusy] = useState('')
  const summaryQuery = useFollowScanSummaryQuery()
  const summary = summaryQuery.data

  useEffect(() => {
    let cancelled = false
    qrPngDataUrl(target, 512).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [target])

  async function run(kind, task) {
    setBusy(kind)
    try {
      await task()
    } catch (error) {
      toast.error(error.message || 'That download failed.')
    } finally {
      setBusy('')
    }
  }

  function handleCopy() {
    navigator.clipboard
      .writeText(sharedUrl)
      .then(() => toast.success('Link copied to clipboard.'))
      .catch(() => toast.error('Could not copy the link — copy it manually.'))
  }

  return (
    <fieldset className="flex flex-col gap-5 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
      <legend className="px-1 text-sm font-bold text-ink-900">Follow hub &amp; QR code</legend>
      <p className="text-sm text-ink-muted">
        This is the page the QR code opens: every social link above plus the rest of the Hub. The code points
        at your own domain, so changing a handle here changes where a scan lands — posters already in the
        department never need reprinting.
      </p>

      <FormField
        label="Poster name (optional)"
        value={campaign}
        onChange={(event) => setCampaign(event.target.value)}
        placeholder="october-flyer"
        maxLength={32}
        helper={
          campaignSlug && campaignSlug !== campaign
            ? `Each poster gets its own code, so scans can be traced back to it. Saved as “${campaignSlug}”.`
            : 'Each poster gets its own code, so scans can be traced back to it. Leave blank for the general code.'
        }
      />

      <div className="flex flex-col gap-5 sm:flex-row">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR code linking to the follow page"
            className="h-36 w-36 shrink-0 rounded-md border border-hairline bg-white p-1"
          />
        ) : (
          <div className="h-36 w-36 shrink-0 animate-pulse rounded-md bg-surface-low" />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={sharedUrl}
              onFocus={(e) => e.target.select()}
              aria-label="Follow link to share"
              className="min-w-0 flex-1 rounded-md border border-hairline bg-surface-low px-3 py-2 text-sm text-ink-muted"
            />
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              Copy
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={busy === 'svg'}
              onClick={() =>
                run('svg', async () => {
                  const svg = await qrSvgText(target)
                  saveBlob(new Blob([svg], { type: 'image/svg+xml' }), `nammes-follow${fileSuffix}-qr.svg`)
                })
              }
            >
              <span className="material-symbols-outlined text-base">download</span>
              Print (SVG)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={busy === 'png'}
              onClick={() =>
                run('png', async () => {
                  const dataUrl = await qrPngDataUrl(target, 2048)
                  const blob = await (await fetch(dataUrl)).blob()
                  saveBlob(blob, `nammes-follow${fileSuffix}-qr.png`)
                })
              }
            >
              <span className="material-symbols-outlined text-base">desktop_windows</span>
              Slide (PNG)
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={busy === 'card'}
              onClick={() =>
                run('card', async () => {
                  saveCardBlob(await renderFollowCard(target), `nammes-follow${fileSuffix}-card.png`)
                })
              }
            >
              <span className="material-symbols-outlined text-base">share</span>
              WhatsApp card
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            Print uses a vector code that stays sharp at poster size. The WhatsApp card is a square image with
            the address written underneath for anyone who cannot scan it.
          </p>
        </div>
      </div>

      <div className="rounded-md border border-hairline bg-surface-low p-4">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="text-sm font-bold text-ink-900">Scans</span>
          {summaryQuery.isLoading ? (
            <span className="text-sm text-ink-muted">Loading…</span>
          ) : summaryQuery.isError || !summary ? (
            <span className="text-sm text-ink-muted">Unavailable right now.</span>
          ) : (
            <>
              <span className="text-sm text-ink-muted">
                <strong className="text-ink-900">{summary.total}</strong> all time
              </span>
              <span className="text-sm text-ink-muted">
                <strong className="text-ink-900">{summary.today}</strong> today
              </span>
              <span className="text-sm text-ink-muted">
                <strong className="text-ink-900">{summary.last7}</strong> in 7 days
              </span>
              <span className="text-sm text-ink-muted">
                <strong className="text-ink-900">{summary.last30}</strong> in 30 days
              </span>
            </>
          )}
        </div>
        {summary?.bySource?.length > 0 && (
          <p className="mt-1 text-xs text-ink-muted">
            {summary.bySource
              .map((row) => `${SOURCE_LABELS[row.source] ?? row.source}: ${row.scans}`)
              .join(' · ')}
          </p>
        )}
        {summary?.byCampaign?.length > 0 && (
          <p className="mt-1 text-xs text-ink-muted">
            By poster:{' '}
            {summary.byCampaign
              .slice(0, 8)
              .map((row) => `${row.campaign}: ${row.scans}`)
              .join(' · ')}
          </p>
        )}
        {summary && (
          <p className="mt-1 text-xs text-ink-muted">
            Chosen after arriving:{' '}
            <strong className="text-ink-900">{summary.linkClicks ?? 0}</strong> link clicks
            {summary.byLink?.length > 0 &&
              ` — ${summary.byLink
                .slice(0, 8)
                .map((row) => `${LINK_LABELS[row.link] ?? row.link}: ${row.clicks}`)
                .join(' · ')}`}
          </p>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          Only arrivals through the code are counted — someone opening /follow from a link on the site is
          ordinary traffic and is not a scan. Link clicks show which channel people chose once they were
          there.
        </p>
      </div>
    </fieldset>
  )
}
