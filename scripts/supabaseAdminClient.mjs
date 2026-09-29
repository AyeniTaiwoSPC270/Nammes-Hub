import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
}

// Seed and maintenance scripts write with the service role, so writing to the live project must be deliberate.
const PRODUCTION_HOST = 'ascdypvchlbpfupsssuy'
if (url.includes(PRODUCTION_HOST) && process.env.ALLOW_PROD_SEED !== 'yes') {
  throw new Error('Refusing to run against production. Set ALLOW_PROD_SEED=yes to confirm you mean it.')
}

export const supabaseAdmin = createClient(url, serviceRoleKey)
