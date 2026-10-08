import { createQuizCardHandler } from './_lib/handlers/quiz-card.js'
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js'

export default createQuizCardHandler(getSupabaseAdmin)