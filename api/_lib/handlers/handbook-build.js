import { getSupabaseAdmin } from '../supabaseAdmin.js'
import { bearerToken, getCaller } from '../authz.js'
import { logError } from '../logError.js'

const BUCKET = 'handbook'
const DOWNLOAD_NAME = 'NAMMES-Hub-Handbook.pdf'
// A build that started longer ago than this is assumed to have died (the function limit is 5 minutes).
const STALE_BUILD_MS = 6 * 60 * 1000

// Admin-only: rebuilds the handbook PDF from the default text plus the edits saved in Admin > Handbook,
// publishes it to the public `handbook` bucket, and points the footer/About download link at it.
export function createHandbookBuildHandler({
  getClient = getSupabaseAdmin,
  build = async (overrides, supabase) => {
    // Loaded on demand so the other routes sharing this function do not pay for the browser and PDF libraries.
    const { buildHandbookPdf } = await import('../handbookBuild.js')
    return buildHandbookPdf({ overrides, supabase })
  },
  overridesFromRows = async (settings, chapters) => (await import('../handbookBuild.js')).overridesFromRows(settings, chapters),
  now = () => Date.now(),
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    const supabaseAdmin = getClient()
    const caller = await getCaller(supabaseAdmin, bearerToken(req))
    if (caller.error) {
      res.status(caller.error[0]).json({ error: caller.error[1] })
      return
    }
    if (!caller.isAdmin) {
      res.status(403).json({ error: 'Admin access required' })
      return
    }

    // Claim the build. Only one at a time, unless the previous one is old enough to be dead.
    const staleBefore = new Date(now() - STALE_BUILD_MS).toISOString()
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('handbook_settings')
      .update({ build_status: 'building', build_started_at: new Date(now()).toISOString(), build_error: null })
      .eq('id', 1)
      .or(`build_status.neq.building,build_started_at.lt.${staleBefore}`)
      .select('id')
    if (claimError) {
      console.error('handbook-build claim failed', claimError.message)
      await logError(supabaseAdmin, 'handbook-build', claimError, 500)
      res.status(500).json({ error: 'Could not start the build' })
      return
    }
    if (!claimed?.length) {
      res.status(409).json({ error: 'A build is already running. Try again in a few minutes.' })
      return
    }

    try {
      const [settingsResult, chaptersResult] = await Promise.all([
        supabaseAdmin.from('handbook_settings').select('edition, as_of, foreword_html, texts, authors').eq('id', 1).maybeSingle(),
        supabaseAdmin.from('handbook_chapters').select('id, title, intro, html'),
      ])
      if (settingsResult.error) throw settingsResult.error
      if (chaptersResult.error) throw chaptersResult.error

      const overrides = await overridesFromRows(settingsResult.data, chaptersResult.data)
      const { pdf, pages } = await build(overrides, supabaseAdmin)

      const stamp = new Date(now()).toISOString().replace(/[-:T]/g, '').slice(0, 14)
      const file = `NAMMES-Hub-Handbook-${stamp}.pdf`
      const upload = await supabaseAdmin.storage.from(BUCKET).upload(file, pdf, { contentType: 'application/pdf', upsert: true })
      if (upload.error) throw upload.error

      const { data: publicUrl } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(file, { download: DOWNLOAD_NAME })
      const { error: linkError } = await supabaseAdmin.from('site_content').update({ handbook_pdf_url: publicUrl.publicUrl }).eq('id', 1)
      if (linkError) throw linkError

      await supabaseAdmin
        .from('handbook_settings')
        .update({ build_status: 'done', built_at: new Date(now()).toISOString(), built_pages: pages, build_error: null })
        .eq('id', 1)

      // Tidy up: keep only the newest file. Failure here is harmless.
      try {
        const { data: files } = await supabaseAdmin.storage.from(BUCKET).list('', { limit: 100 })
        const old = (files ?? []).map((f) => f.name).filter((name) => name !== file && name.endsWith('.pdf'))
        if (old.length) await supabaseAdmin.storage.from(BUCKET).remove(old)
      } catch (cleanupError) {
        console.error('handbook-build cleanup failed', cleanupError?.message)
      }

      // Author photos no longer used. Files under a day old are kept: an admin may have uploaded one and not saved yet.
      try {
        const inUse = new Set(
          (overrides.authors?.people ?? []).map((p) => p.photo).filter((x) => x?.startsWith('store:')).map((x) => x.slice(6)),
        )
        const { data: photos } = await supabaseAdmin.storage.from(BUCKET).list('authors', { limit: 200 })
        const cutoff = now() - 24 * 60 * 60 * 1000
        const unused = (photos ?? [])
          .filter((f) => !inUse.has(`authors/${f.name}`) && f.created_at && new Date(f.created_at).getTime() < cutoff)
          .map((f) => `authors/${f.name}`)
        if (unused.length) await supabaseAdmin.storage.from(BUCKET).remove(unused)
      } catch (cleanupError) {
        console.error('handbook-build photo cleanup failed', cleanupError?.message)
      }

      res.status(200).json({ url: publicUrl.publicUrl, pages })
    } catch (error) {
      console.error('handbook-build failed', error?.message)
      await logError(supabaseAdmin, 'handbook-build', error, 500)
      await supabaseAdmin
        .from('handbook_settings')
        .update({ build_status: 'failed', build_error: String(error?.message ?? error).slice(0, 300) })
        .eq('id', 1)
      res.status(500).json({ error: 'The PDF could not be built. Your edits are saved; try again in a minute.' })
    }
  }
}

export default createHandbookBuildHandler()
