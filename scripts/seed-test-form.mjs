import { supabaseAdmin } from './supabaseAdminClient.mjs'

const {
  data: { users },
  error: usersError,
} = await supabaseAdmin.auth.admin.listUsers()
if (usersError) throw usersError
if (users.length === 0) throw new Error('No users found — sign up at least one account first.')
const createdBy = users[0].id

const { data: form, error: formError } = await supabaseAdmin
  .from('forms')
  .insert({
    title: 'Share Link Test Form',
    description: 'A detailed test form covering every question type, for testing the share-link + QR code feature.',
    category: 'survey',
    is_accepting_responses: true,
    closes_at: null,
    require_signin: false,
    one_response_per_person: false,
    allow_edit_after_submit: false,
    created_by: createdBy,
  })
  .select()
  .single()
if (formError) throw formError

const questions = [
  {
    form_id: form.id,
    position: 0,
    type: 'short_text',
    label: 'What is your full name?',
    helper_text: null,
    required: true,
    options: null,
    scale_min: null,
    scale_max: null,
    scale_min_label: null,
    scale_max_label: null,
  },
  {
    form_id: form.id,
    position: 1,
    type: 'paragraph',
    label: 'Tell us about yourself',
    helper_text: 'A few sentences is fine.',
    required: false,
    options: null,
    scale_min: null,
    scale_max: null,
    scale_min_label: null,
    scale_max_label: null,
  },
  {
    form_id: form.id,
    position: 2,
    type: 'multiple_choice',
    label: 'Which department are you in?',
    helper_text: null,
    required: true,
    options: ['Mechanical Engineering', 'Metallurgical & Materials Engineering', 'Other'],
    scale_min: null,
    scale_max: null,
    scale_min_label: null,
    scale_max_label: null,
  },
  {
    form_id: form.id,
    position: 3,
    type: 'checkboxes',
    label: 'Which events have you attended?',
    helper_text: 'Select all that apply.',
    required: false,
    options: ['Freshers Welcome', 'Career Fair', 'Hub Launch', 'None of the above'],
    scale_min: null,
    scale_max: null,
    scale_min_label: null,
    scale_max_label: null,
  },
  {
    form_id: form.id,
    position: 4,
    type: 'dropdown',
    label: 'What year are you in?',
    helper_text: null,
    required: true,
    options: ['100L', '200L', '300L', '400L', '500L'],
    scale_min: null,
    scale_max: null,
    scale_min_label: null,
    scale_max_label: null,
  },
  {
    form_id: form.id,
    position: 5,
    type: 'linear_scale',
    label: 'How likely are you to recommend the Hub to a friend?',
    helper_text: null,
    required: false,
    options: null,
    scale_min: 1,
    scale_max: 5,
    scale_min_label: 'Not likely',
    scale_max_label: 'Very likely',
  },
  {
    form_id: form.id,
    position: 6,
    type: 'file_upload',
    label: 'Upload a photo (optional)',
    helper_text: null,
    required: false,
    options: null,
    scale_min: null,
    scale_max: null,
    scale_min_label: null,
    scale_max_label: null,
  },
  {
    form_id: form.id,
    position: 7,
    type: 'date',
    label: 'Preferred event date',
    helper_text: null,
    required: false,
    options: null,
    scale_min: null,
    scale_max: null,
    scale_min_label: null,
    scale_max_label: null,
  },
  {
    form_id: form.id,
    position: 8,
    type: 'time',
    label: 'Preferred time',
    helper_text: null,
    required: false,
    options: null,
    scale_min: null,
    scale_max: null,
    scale_min_label: null,
    scale_max_label: null,
  },
]

const { error: questionsError } = await supabaseAdmin.from('form_questions').insert(questions)
if (questionsError) throw questionsError

console.log(`Seeded form "${form.title}" (id: ${form.id}) with ${questions.length} questions.`)
console.log(`Public link: /forms/${form.id}`)
