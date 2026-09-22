import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePageBannersQuery, updatePageBanner } from '../../data/pageBanners'
import PageBannerImageUploadField from '../../components/admin/PageBannerImageUploadField'
import FormField from '../../components/ui/FormField'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonText } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'

const PAGES = [
  { key: 'about', label: 'About' },
  { key: 'contact', label: 'Contact' },
  { key: 'events', label: 'Events' },
  { key: 'excos', label: 'Meet the Excos' },
  { key: 'news', label: 'News' },
  { key: 'opportunities', label: 'Opportunities' },
  { key: 'outlines', label: 'Outlines' },
  { key: 'resources', label: 'Resources' },
  { key: 'timetable', label: 'Timetable' },
]

function BannerFieldset({ page, row }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ title: '', subtitle: '', image_url: null })

  useEffect(() => {
    if (row) setForm({ title: row.title ?? '', subtitle: row.subtitle ?? '', image_url: row.image_url ?? null })
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
        <PageBannerImageUploadField
          label="Banner image"
          url={form.image_url}
          onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
        />
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
        Edit the title, subtitle, and background image shown at the top of each page. Remove the image to
        fall back to a plain green banner.
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
