import { useQuery } from '@tanstack/react-query'
import { isGoogleDriveUrl } from './googleDrive'

async function fetchDriveFileName(url) {
  const res = await fetch(`/api/drive-file-name?url=${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error('Could not resolve file name')
  const { name } = await res.json()
  return name
}

// Resolves a Google Drive share link to the file's real name, so admin-pasted
// links (e.g. "https://drive.google.com/file/d/...") can display as
// "Fluid Mechanics Textbook.pdf" instead of the raw URL.
export function useDriveFileName(url) {
  return useQuery({
    queryKey: ['drive-file-name', url],
    queryFn: () => fetchDriveFileName(url),
    enabled: Boolean(url) && isGoogleDriveUrl(url),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  })
}
