import { supabaseAdmin } from './supabaseAdminClient.mjs'
import { opportunities } from '../src/data/opportunities.js'

const { error } = await supabaseAdmin.from('opportunities').insert(opportunities)
if (error) throw error
console.log(`Seeded ${opportunities.length} opportunities rows.`)
