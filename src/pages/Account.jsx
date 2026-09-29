import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/ToastContext'
import Reveal from '../components/ui/Reveal'
import Button from '../components/ui/Button'
import FormField from '../components/ui/FormField'
import { useNotificationPrefQuery, useSetNotificationPrefMutation } from '../data/notificationPrefs'
import { requestDataExport, saveAsJsonFile } from '../data/dataExport'
import { useOwnProfileQuery, useSetFullNameMutation, useSetEntryYearMutation } from '../data/profiles'

const CURRENT_YEAR = new Date().getFullYear()
const ENTRY_YEARS = Array.from({ length: 8 }, (_, i) => String(CURRENT_YEAR - i))

export default function Account() {
  const { user, loading } = useAuth()
  const toast = useToast()
  const prefQuery = useNotificationPrefQuery(user?.id)
  const setPrefMutation = useSetNotificationPrefMutation(user?.id)
  const profileQuery = useOwnProfileQuery(user?.id)
  const setFullNameMutation = useSetFullNameMutation(user?.id)
  const setEntryYearMutation = useSetEntryYearMutation(user?.id)

  const [nameDraft, setNameDraft] = useState(null)
  const [exporting, setExporting] = useState(false)

  if (loading || (user && (prefQuery.isLoading || profileQuery.isLoading))) return null
  if (!user) return <Navigate to="/login" replace />

  const enabled = prefQuery.data ?? true
  const fullName = nameDraft ?? profileQuery.data?.full_name ?? ''
  const entryYear = profileQuery.data?.entry_year ? String(profileQuery.data.entry_year) : ''

  function toggle() {
    setPrefMutation.mutate(!enabled, {
      onSuccess: () => toast.success(!enabled ? 'Email notifications turned on.' : 'Email notifications turned off.'),
      onError: (error) => toast.error(error.message),
    })
  }

  async function exportData(delivery) {
    setExporting(true)
    try {
      const result = await requestDataExport(delivery)
      if (delivery === 'download') {
        saveAsJsonFile(result.data)
        toast.success('Your data has been downloaded.')
      } else {
        toast.success(`Your data was emailed to ${user.email}.`)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setExporting(false)
    }
  }

  function saveName(event) {
    event.preventDefault()
    setFullNameMutation.mutate(fullName.trim(), {
      onSuccess: () => {
        toast.success('Name updated.')
        setNameDraft(null)
      },
      onError: (error) => toast.error(error.message),
    })
  }

  function changeEntryYear(event) {
    const value = event.target.value
    setEntryYearMutation.mutate(value ? Number(value) : null, {
      onSuccess: () => toast.success('100 Level session updated.'),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <div className="mx-auto max-w-[600px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Account</h1>
      <p className="mt-1 text-ink-muted">{user.email}</p>

      <Reveal className="mt-8 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
        <h2 className="font-bold text-ink-900">Full name</h2>
        <p className="text-sm text-ink-muted">Shown on your CGPA report and to admins.</p>
        <form onSubmit={saveName} className="mt-3 flex flex-wrap items-end gap-3">
          <FormField
            label="Name"
            value={fullName}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="Ada Okafor"
          />
          <Button variant="primary" size="sm" type="submit" loading={setFullNameMutation.isPending}>
            Save
          </Button>
        </form>
      </Reveal>

      <Reveal delay={0.04} className="mt-6 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
        <h2 className="font-bold text-ink-900">100 Level session</h2>
        <p className="text-sm text-ink-muted">
          The year you started 100 Level. Used to work out the correct academic session for every level on your CGPA
          report (e.g. 2024 start &rarr; 100L is 2024/2025, 200L is 2025/2026, and so on).
        </p>
        <div className="mt-3 max-w-[200px]">
          <FormField
            label="Year"
            type="select"
            options={['', ...ENTRY_YEARS]}
            value={entryYear}
            onChange={changeEntryYear}
          />
        </div>
      </Reveal>

      <Reveal delay={0.08} className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
        <div>
          <h2 className="font-bold text-ink-900">Email notifications</h2>
          <p className="text-sm text-ink-muted">New News/Events alerts and department broadcasts.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={toggle}
            disabled={setPrefMutation.isPending}
            className="h-5 w-5 accent-green-900"
          />
        </label>
      </Reveal>
      <Reveal delay={0.12} className="mt-6 rounded-lg border border-hairline bg-surface p-5 shadow-sm">
        <h2 className="font-bold text-ink-900">Your data</h2>
        <p className="text-sm text-ink-muted">
          A copy of your profile, CGPA semesters, form responses, nominations and outline submissions. Votes are
          left out to keep ballots secret. See our{' '}
          <Link to="/privacy" className="font-semibold text-orange-600 hover:underline">
            privacy page
          </Link>
          .
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" loading={exporting} onClick={() => exportData('download')}>
            Download my data
          </Button>
          <Button variant="secondary" size="sm" loading={exporting} onClick={() => exportData('email')}>
            Email it to me
          </Button>
        </div>
      </Reveal>
    </div>
  )
}
