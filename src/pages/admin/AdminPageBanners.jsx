import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePageBannersQuery, updatePageBanner } from '../../data/pageBanners'
import PageBannerImagesField from '../../components/admin/PageBannerImagesField'
import FormField from '../../components/ui/FormField'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonText } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'

const PAGES = [
  { key: 'about', label: 'About' },
  { key: 'awards', label: 'Awards' },
  { key: 'cgpa', label: 'CGPA Calculator', imagesOnly: true },
  { key: 'contact', label: 'Contact' },
  { key: 'curriculum', label: 'Curriculum' },
  { key: 'events', label: 'Events' },
  { key: 'excos', label: 'Meet the Excos' },
  { key: 'forms', label: 'Forms' },
  { key: 'news', label: 'News' },
  { key: 'opportunities', label: 'Opportunities' },
  { key: 'outlines', label: 'Outlines' },
  { key: 'quizzes', label: 'Quizzes' },
  { key: 'resources', label: 'Resources' },
  { key: 'timetable', label: 'Timetable' },
]

function BannerFieldset({ page, row }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ title: '', subtitle: '', image_urls: [], transition: 'fade', interval_seconds: 5 })

  useEffect(() => {
    if (row) {
      setForm({
        title: row.title ?? '',
        subtitle: row.subtitle ?? '',
        image_urls: row.image_urls ?? [],
        transition: row.transition ?? 'fade',
        interval_seconds: row.interval_seconds ?? 5,
      })
    }
  }, [row])

  const saveMutation = useMutation({
    mutationFn: (fields) => updatePageBanner(page.key, fields),
    onSuccess: (data) => {
      queryClient.setQueryData(['page_banners'], (prev) =>
        (prev || []).map((r) => (r.page_key === page.key ? data : r)),
      )
      toast.success(`${page.label} banner updated.`)
    },
    onError: (error) => toast.error(error.message),
  })

  function handleSubmit(event) {
    event.preventDefault()
    saveMutation.mutate(form)
  }

  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
      <legend className="px-1 text-sm font-bold text-ink-900">{page.label}</legend>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {page.imagesOnly ? (
          <p className="text-sm text-ink-muted">
            This page has no title/subtitle banner &mdash; these images set the background of its "Cumulative GPA" card.
          </p>
        ) : (
          <>
            <FormField
              label="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
            <FormField
              label="Subtitle"
              type="textarea"
              value={form.subtitle}
              onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
              required
            />
          </>
        )}
        <PageBannerImagesField
          label="Banner images"
          urls={form.image_urls}
          onChange={(urls) => setForm((f) => ({ ...f, image_urls: urls }))}
        />
        {form.image_urls.length >= 2 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 font-body">
              <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">Transition</span>
              <select
                value={form.transition}
                onChange={(e) => setForm((f) => ({ ...f, transition: e.target.value }))}
                className="rounded-md border border-hairline bg-surface px-3 py-2.5 text-base text-ink focus:outline-none focus:border-brand"
              >
                <option value="fade">Fade</option>
                <option value="slide">Slide</option>
                <option value="zoom">Zoom</option>
              </select>
            </label>
            <FormField
              label="Seconds per slide"
              type="number"
              value={form.interval_seconds}
              onChange={(e) => setForm((f) => ({ ...f, interval_seconds: Math.max(1, Number(e.target.value) || 1) }))}
            />
          </div>
        )}
        <div>
          <Button type="submit" variant="primary" loading={saveMutation.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </fieldset>
  )
}

export default function AdminPageBanners() {
  const bannersQuery = usePageBannersQuery()

  if (bannersQuery.isError && !bannersQuery.data) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load page banners right now." onRetry={bannersQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Page Banners</h1>
      <p className="mt-1 text-ink-muted">
        Edit the title, subtitle, and background images shown at the top of each page. Add 2 or more images to
        turn the banner into an auto-playing slideshow. Remove all images to fall back to a plain green banner.
      </p>

      {bannersQuery.isLoading ? (
        <div className="mt-6 flex flex-col gap-3">
          <SkeletonText lines={6} />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {PAGES.map((page) => (
            <BannerFieldset
              key={page.key}
              page={page}
              row={bannersQuery.data.find((r) => r.page_key === page.key)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
