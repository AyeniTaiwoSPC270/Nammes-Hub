import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSiteContentQuery, updateSiteContent } from '../../data/siteContent'
import FormField from '../../components/ui/FormField'
import Button from '../../components/ui/Button'
import HomeContentImageUploadField from '../../components/admin/HomeContentImageUploadField'
import PageBannerImagesField from '../../components/admin/PageBannerImagesField'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonText } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'
import { heroImages } from '../../lib/heroImages'

const EMPTY_FORM = {
  hero_title: '',
  hero_subtitle: '',
  hero_image_url: '',
  hero_image_urls: [],
  hero_transition: 'fade',
  hero_interval_seconds: 5,
  president_name: '',
  president_role: '',
  president_message: '',
  president_photo_url: '',
}

export default function AdminHomeContent() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const contentQuery = useSiteContentQuery()
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (!contentQuery.data) return
    const row = contentQuery.data
    setForm({
      ...EMPTY_FORM,
      ...row,
      hero_image_urls: heroImages(row),
      hero_transition: row.hero_transition ?? 'fade',
      hero_interval_seconds: row.hero_interval_seconds ?? 5,
    })
  }, [contentQuery.data])

  const saveMutation = useMutation({
    mutationFn: updateSiteContent,
    onSuccess: (data) => {
      queryClient.setQueryData(['site_content'], data)
      toast.success('Home page content updated.')
    },
    onError: (error) => toast.error(error.message),
  })

  function field(key) {
    return {
      value: form[key],
      onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const urls = form.hero_image_urls ?? []
    saveMutation.mutate({
      ...form,
      hero_image_url: urls[0] ?? '',
      hero_image_urls: urls,
    })
  }

  if (contentQuery.isError && !contentQuery.data) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load home page content right now." onRetry={contentQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Home Page Content</h1>
      <p className="mt-1 text-ink-muted">Edit the hero banner and the president's welcome message.</p>

      {contentQuery.isLoading ? (
        <div className="mt-6 flex flex-col gap-3">
          <SkeletonText lines={6} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-8">
          <fieldset className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
            <legend className="px-1 text-sm font-bold text-ink-900">Hero banner</legend>
            <FormField label="Title" {...field('hero_title')} required />
            <FormField label="Subtitle" type="textarea" {...field('hero_subtitle')} required />
            <PageBannerImagesField
              label="Background images"
              bucket="home-content"
              urls={form.hero_image_urls}
              onChange={(urls) => setForm((f) => ({ ...f, hero_image_urls: urls }))}
            />
            {form.hero_image_urls.length >= 2 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 font-body">
                  <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">Transition</span>
                  <select
                    value={form.hero_transition}
                    onChange={(e) => setForm((f) => ({ ...f, hero_transition: e.target.value }))}
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
                  value={form.hero_interval_seconds}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hero_interval_seconds: Math.max(1, Number(e.target.value) || 1) }))
                  }
                />
              </div>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
            <legend className="px-1 text-sm font-bold text-ink-900">President's message</legend>
            <FormField label="Name" {...field('president_name')} required />
            <FormField label="Role" {...field('president_role')} required />
            <FormField
              label="Message"
              type="textarea"
              helper="Leave a blank line between paragraphs."
              {...field('president_message')}
              required
            />
            <HomeContentImageUploadField
              label="Photo"
              url={form.president_photo_url}
              onChange={(url) => setForm((f) => ({ ...f, president_photo_url: url }))}
            />
          </fieldset>

          <Button type="submit" variant="primary" loading={saveMutation.isPending}>
            Save changes
          </Button>
        </form>
      )}
    </div>
  )
}
