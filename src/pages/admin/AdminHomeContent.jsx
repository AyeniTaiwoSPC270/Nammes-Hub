import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSiteContentQuery, updateSiteContent } from '../../data/siteContent'
import FormField from '../../components/ui/FormField'
import Button from '../../components/ui/Button'
import HomeContentImageUploadField from '../../components/admin/HomeContentImageUploadField'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonText } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'

const EMPTY_FORM = {
  hero_title: '',
  hero_subtitle: '',
  hero_image_url: '',
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
    if (contentQuery.data) setForm({ ...EMPTY_FORM, ...contentQuery.data })
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
    saveMutation.mutate(form)
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
            <HomeContentImageUploadField
              label="Background image"
              url={form.hero_image_url}
              onChange={(url) => setForm((f) => ({ ...f, hero_image_url: url }))}
            />
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
