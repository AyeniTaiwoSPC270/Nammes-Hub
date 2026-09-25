import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSiteContentQuery, updateSiteContent } from '../../data/siteContent'
import { SOCIAL_PLATFORMS } from '../../components/SocialIcons'
import FormField from '../../components/ui/FormField'
import Button from '../../components/ui/Button'
import Toggle from '../../components/ui/Toggle'
import ErrorState from '../../components/ui/ErrorState'
import { SkeletonText } from '../../components/ui/Skeleton'
import { useToast } from '../../lib/ToastContext'

const EMPTY_FORM = {
  substack_url: '',
  whatsapp_url: '',
  x_url: '',
  instagram_url: '',
  linkedin_url: '',
  youtube_url: '',
  maintenance_mode: false,
  maintenance_message: '',
  maintenance_contact_email: '',
}

export default function AdminSiteLinks() {
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
      toast.success('Site links updated.')
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
        <ErrorState message="Couldn't load site links right now." onRetry={contentQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Site Links</h1>
      <p className="mt-1 text-ink-muted">
        Edit the Substack newsletter link and social media links shown in the footer. Leave a field blank
        to hide it from the site.
      </p>

      {contentQuery.isLoading ? (
        <div className="mt-6 flex flex-col gap-3">
          <SkeletonText lines={6} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-8">
          <fieldset className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
            <legend className="px-1 text-sm font-bold text-ink-900">Maintenance mode</legend>
            <Toggle
              checked={form.maintenance_mode}
              onChange={(checked) => setForm((f) => ({ ...f, maintenance_mode: checked }))}
              label="Site under maintenance"
              description="Shows the maintenance page to every visitor except signed-in admins."
            />
            <FormField
              label="Status message"
              type="textarea"
              placeholder="NAMMES Hub is currently undergoing scheduled maintenance…"
              helper="Shown on the maintenance page. Leave blank to use the default message."
              {...field('maintenance_message')}
            />
            <FormField
              label="Contact email"
              type="email"
              placeholder="excos@nammes.example"
              helper="Shows a 'Reach an Exco' button on the maintenance page. Leave blank to hide it."
              {...field('maintenance_contact_email')}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
            <legend className="px-1 text-sm font-bold text-ink-900">Newsletter</legend>
            <FormField
              label="Substack URL"
              type="url"
              placeholder="https://yourpublication.substack.com"
              {...field('substack_url')}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
            <legend className="px-1 text-sm font-bold text-ink-900">Social media</legend>
            {SOCIAL_PLATFORMS.map(({ key, label }) => (
              <FormField key={key} label={label} type="url" placeholder="https://…" {...field(key)} />
            ))}
          </fieldset>

          <Button type="submit" variant="primary" loading={saveMutation.isPending}>
            Save changes
          </Button>
        </form>
      )}
    </div>
  )
}
