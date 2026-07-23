import { useParams } from 'react-router-dom'
import PagePlaceholder from '../components/PagePlaceholder'

export default function NewsDetail() {
  const { id } = useParams()

  return (
    <PagePlaceholder
      eyebrow="News"
      title={`News post ${id}`}
      description="Full news post detail view."
    />
  )
}
