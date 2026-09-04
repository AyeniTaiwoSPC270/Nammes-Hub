import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import PageBanner from '../components/PageBanner'
import FormField from '../components/ui/FormField'
import Button from '../components/ui/Button'
import SocialIcons from '../components/SocialIcons'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../lib/ToastContext'

export default function Contact() {
  const toast = useToast()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !email.trim() || !message.trim()) {
        throw new Error('Fill in your name, email, and message.')
      }
      const { error } = await supabase.from('contact_messages').insert({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Thanks for reaching out — we'll get back to you soon.")
      setName('')
      setEmail('')
      setMessage('')
      setFormError('')
    },
    onError: (error) => {
      setFormError(error.message)
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    submitMutation.mutate()
  }

  return (
    <div>
      <PageBanner title="Contact Us" subtitle="Questions, feedback, or ideas for NAMMES Hub? We'd love to hear from you." size="md" />

      <section className="mx-auto max-w-[1000px] px-5 sm:px-6 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[3fr_2fr]">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
            <FormField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <FormField
              label="Message"
              type="textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help?"
              required
            />
            {formError && <span className="text-xs text-danger">{formError}</span>}
            <Button variant="primary" type="submit" loading={submitMutation.isPending}>
              Send message
            </Button>
          </form>

          <div className="flex flex-col gap-8">
            <div className="rounded-lg border border-hairline bg-surface-low p-6">
              <h3 className="mb-1.5 text-base font-bold text-ink-900">Prefer to reach someone directly?</h3>
              <p className="mb-3 text-sm text-ink-muted">
                Get in touch with an Exco for role-specific questions.
              </p>
              <Link
                to="/excos"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-900 no-underline hover:text-orange-500 hover:underline"
              >
                Meet the Excos
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>

            <div>
              <h3 className="mb-3 text-base font-bold text-ink-900">Follow us</h3>
              <SocialIcons variant="light" />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
