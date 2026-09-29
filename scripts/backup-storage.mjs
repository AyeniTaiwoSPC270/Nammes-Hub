// Downloads every file from every storage bucket (database backups do not include storage files).
// Usage (from a trusted machine):
//   VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-storage.mjs ./storage-backup
// Keep the output outside the repo and encrypt it if it leaves your machine. It contains uploaded documents.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// Read-only, so it deliberately does not use the write-guarded seed client.
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const out = process.argv[2] ?? './storage-backup'
let files = 0
let skipped = 0

async function walk(bucket, prefix = '') {
  const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error) throw error
  for (const item of data) {
    const path = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id === null) {
      await walk(bucket, path)
      continue
    }
    const { data: blob, error: downloadError } = await db.storage.from(bucket).download(path)
    if (downloadError) {
      console.error('skipped', bucket, path, downloadError.message)
      skipped += 1
      continue
    }
    const dest = join(out, bucket, path)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, Buffer.from(await blob.arrayBuffer()))
    files += 1
  }
}

const { data: buckets, error } = await db.storage.listBuckets()
if (error) throw error
for (const bucket of buckets) await walk(bucket.id)
console.log(`Backed up ${files} files to ${out} (${skipped} skipped).`)
