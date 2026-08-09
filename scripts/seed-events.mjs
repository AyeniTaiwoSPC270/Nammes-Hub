import { supabaseAdmin } from './supabaseAdminClient.mjs'
import { events } from '../src/data/events.js'

const { error } = await supabaseAdmin.from('events').insert(events)
if (error) throw error
console.log(`Seeded ${events.length} events rows.`)
