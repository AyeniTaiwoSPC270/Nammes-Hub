import { isBareUrl, linkifyText } from '../../lib/linkify'
import { isGoogleDriveUrl } from '../../lib/googleDrive'
import { useDriveFileName } from '../../lib/useDriveFileName'

function DriveTextLink({ url }) {
  const { data: name, isLoading } = useDriveFileName(url)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand underline underline-offset-2 hover:opacity-80"
    >
      {name || (isLoading ? 'Loading file name…' : url)}
    </a>
  )
}

// Renders one "Recommended texts" entry: a plain book citation, a bare link
// (shown as its real Drive file name when possible), or prose with a link in it.
export default function RecommendedTextItem({ text }) {
  if (isBareUrl(text) && isGoogleDriveUrl(text)) return <DriveTextLink url={text.trim()} />

  if (isBareUrl(text)) {
    const url = text.trim()
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand underline underline-offset-2 hover:opacity-80"
      >
        {url}
      </a>
    )
  }

  return <>{linkifyText(text)}</>
}
