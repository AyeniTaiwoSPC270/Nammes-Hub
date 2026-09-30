// Email clients ignore CSS cropping and filters, so an image's crop, rotation, flips and colour
// adjustments are baked into a real image file before it is sent. The untouched upload is kept
// (`src`) so the picture can be re-adjusted later.

import { DEFAULT_ADJUST, normalizeAdjust, EMAIL_IMAGE_ASPECTS } from '../../api/_lib/emailDesign.js'
import { safeFileName } from './uploadPath'

const BUCKET = 'broadcast-images'
const MAX_OUTPUT_WIDTH = 1200

export function isDefaultAdjust(adjust) {
  const a = normalizeAdjust(adjust)
  return JSON.stringify(a) === JSON.stringify(DEFAULT_ADJUST)
}

/** Identifies one combination of source picture + adjustments, so an unchanged image is never re-baked. */
export function adjustKey(src, adjust) {
  return `${src}|${JSON.stringify(normalizeAdjust(adjust))}`
}

function ratioOf(aspect) {
  const [w, h] = aspect.split(':').map(Number)
  return w && h ? w / h : null
}

export function aspectRatio(aspect) {
  if (!EMAIL_IMAGE_ASPECTS.some((a) => a.value === aspect) || aspect === 'free') return null
  return ratioOf(aspect)
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the image to adjust it.'))
    img.src = url
  })
}

/** Where the crop box sits inside the (rotated) image, in source pixels. Pure, so it can be tested. */
export function cropRect(width, height, adjust) {
  const a = normalizeAdjust(adjust)
  const swap = a.rotate === 90 || a.rotate === 270
  const W = swap ? height : width
  const H = swap ? width : height
  const ratio = aspectRatio(a.aspect)
  if (ratio === null) return { W, H, sx: 0, sy: 0, sw: W, sh: H }
  let baseW = W
  let baseH = W / ratio
  if (baseH > H) {
    baseH = H
    baseW = H * ratio
  }
  const sw = baseW / a.zoom
  const sh = baseH / a.zoom
  return { W, H, sx: (W - sw) * (a.x / 100), sy: (H - sh) * (a.y / 100), sw, sh }
}

/** Renders the adjusted image to a JPEG blob. */
export async function bakeImage(srcUrl, adjust, targetWidth = MAX_OUTPUT_WIDTH) {
  const a = normalizeAdjust(adjust)
  const img = await loadImage(srcUrl)
  const { W, H, sx, sy, sw, sh } = cropRect(img.naturalWidth, img.naturalHeight, a)

  // 1) Rotate and flip the whole picture.
  const stage = document.createElement('canvas')
  stage.width = Math.round(W)
  stage.height = Math.round(H)
  const sctx = stage.getContext('2d')
  sctx.translate(stage.width / 2, stage.height / 2)
  sctx.rotate((a.rotate * Math.PI) / 180)
  sctx.scale(a.flipH ? -1 : 1, a.flipV ? -1 : 1)
  sctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)

  // 2) Crop, scale to the output size, and apply the colour adjustments.
  const outW = Math.max(1, Math.min(Math.round(targetWidth), MAX_OUTPUT_WIDTH, Math.round(sw)))
  const outH = Math.max(1, Math.round(outW * (sh / sw)))
  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, outW, outH)
  const filters = []
  if (a.brightness !== 100) filters.push(`brightness(${a.brightness}%)`)
  if (a.contrast !== 100) filters.push(`contrast(${a.contrast}%)`)
  if (a.saturate !== 100) filters.push(`saturate(${a.saturate}%)`)
  if (a.grayscale > 0) filters.push(`grayscale(${a.grayscale}%)`)
  if (filters.length && 'filter' in ctx) ctx.filter = filters.join(' ')
  ctx.drawImage(stage, sx, sy, sw, sh, 0, 0, outW, outH)

  return new Promise((resolve, reject) => {
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not export the adjusted image.'))), 'image/jpeg', 0.88)
  })
}

function isImageObject(o) {
  return o && typeof o === 'object' && typeof o.src === 'string' && o.src
}

function widthFor(obj, isBanner) {
  return isBanner ? MAX_OUTPUT_WIDTH : Math.round((MAX_OUTPUT_WIDTH * (obj.widthPct ?? 100)) / 100)
}

/**
 * Bakes (and uploads) every image whose adjustments changed since it was last baked.
 * Returns new { blocks, design } with `url` pointing at the baked file. Images left at their default
 * adjustments are sent as the original upload.
 */
export async function finalizeEmailImages({ blocks, design }, upload = defaultUpload) {
  const cache = new Map()

  async function settle(obj, isBanner) {
    if (!isImageObject(obj)) return obj
    const key = adjustKey(obj.src, obj.adjust)
    if (isDefaultAdjust(obj.adjust)) return { ...obj, url: obj.src, bakeKey: '' }
    if (obj.bakeKey === key && obj.url) return obj
    const width = widthFor(obj, isBanner)
    const cacheKey = `${key}@${width}`
    if (!cache.has(cacheKey)) cache.set(cacheKey, bakeImage(obj.src, obj.adjust, width).then(upload))
    return { ...obj, url: await cache.get(cacheKey), bakeKey: key }
  }

  async function settleBlock(b) {
    if (b.type === 'image') return settle(b, false)
    if (b.type === 'columns') return { ...b, left: await settleBlock(b.left), right: await settleBlock(b.right) }
    return b
  }

  const nextBlocks = []
  for (const b of blocks) nextBlocks.push(await settleBlock(b))
  let nextDesign = design
  if (design?.header?.banner) {
    nextDesign = { ...design, header: { ...design.header, banner: await settle(design.header.banner, true) } }
  }
  return { blocks: nextBlocks, design: nextDesign }
}

async function defaultUpload(blob) {
  const { supabase } = await import('./supabaseClient')
  const path = `baked/${Date.now()}-${safeFileName(Math.random().toString(36).slice(2))}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Uploads an original picture and returns its public URL. */
export async function uploadOriginal(file) {
  const { supabase } = await import('./supabaseClient')
  const path = `originals/${Date.now()}-${safeFileName(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** Every adjusted picture in an email, as [{ url, src, adjust, bakeKey }] — used to build the live preview. */
export function collectImages(blocks, design) {
  const found = []
  const visit = (b) => {
    if (!b) return
    if (b.type === 'image') found.push(b)
    if (b.type === 'columns') {
      visit(b.left)
      visit(b.right)
    }
  }
  blocks.forEach(visit)
  if (design?.header?.banner) found.push(design.header.banner)
  return found.filter(isImageObject)
}
