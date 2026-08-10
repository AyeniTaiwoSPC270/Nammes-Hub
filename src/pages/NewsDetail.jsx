import { useEffect, useState } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { fetchNews, getNewsById } from '../data/news'

export default function NewsDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNews().then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
        <p className="text-ink-muted">Loading…</p>
      </div>
    )
  }

  const post = getNewsById(rows, id)
  if (!post) return <Navigate to="/news" replace />

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'News', to: '/news' }, { label: post.title }]} />

      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
        {post.category}
      </div>
      <h1 className="mt-1.5 text-[32px]">{post.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-sm text-ink-muted">
        <span>Posted by {post.author}</span>
        <span aria-hidden="true">&middot;</span>
        <span>{post.date}</span>
        {post.badge_tone && <Badge tone={post.badge_tone}>{post.badge_label}</Badge>}
      </div>

      {post.image_url && (
        <img
          src={post.image_url}
          alt=""
          style={{ width: `${post.image_width_pct || 100}%` }}
          className="mt-6 rounded-lg"
        />
      )}

      <p className="mt-6 max-w-2xl leading-relaxed text-ink">{post.body}</p>

      <div className="mt-8">
        <Button variant="ghost" onClick={() => navigate('/news')}>
          Back to news
        </Button>
      </div>
    </div>
  )
}
