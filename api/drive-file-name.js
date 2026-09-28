import { extractDriveFileId, titleToFileName } from './_lib/googleDrive.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { url } = req.query
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing url' })
    return
  }

  const fileId = extractDriveFileId(url)
  if (!fileId) {
    res.status(422).json({ error: 'Not a recognizable Google Drive link' })
    return
  }

  try {
    const pageUrl = `https://drive.google.com/file/d/${fileId}/view`
    const response = await fetch(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NammesHub/1.0)' },
    })
    if (!response.ok) throw new Error(`Drive responded ${response.status}`)

    const html = await response.text()
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i)
    const name = titleMatch ? titleToFileName(titleMatch[1]) : ''
    if (!name) throw new Error('Could not read file name from Drive page')

    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    res.status(200).json({ name })
  } catch (error) {
    console.error('drive-file-name: lookup failed', error)
    res.status(502).json({ error: 'Could not resolve file name' })
  }
}
