import { supabaseAdmin } from './supabaseAdminClient.mjs'
import { excos } from '../src/data/excos.js'

const { error } = await supabaseAdmin.from('excos').insert(excos)
if (error) throw error
console.log(`Seeded ${excos.length} excos rows.`)
