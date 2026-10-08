import { supabase } from './supabaseClient'
import { fileSlug } from './downloadFile.js'

const ENDPOINT = '/api/quiz-card'

export function personalCardUrl({ sessionId, token }) {
  return `${ENDPOINT}?session=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`
}

export function boardCardUrl(sessionId) {
  return `${ENDPOINT}?session=${encodeURIComponent(sessionId)}&view=board`
}

export function practiceCardUrl(shareCode) {
  return `${ENDPOINT}?practice=${encodeURIComponent(shareCode)}`
}

export function duelCardUrl(code) {
  return `${ENDPOINT}?battle=${encodeURIComponent(code)}`
}

// Fetches the PNG as bytes. The board variant needs the admin's own session, because a plain <img> cannot send an
// Authorization header — so every card goes through here rather than through an img src.
export async function fetchCardBlob(url, { admin = false } = {}) {
  const headers = {}
  if (admin) {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`
  }
  const response = await fetch(url, { headers })
  if (!response.ok) {
    let message = 'Could not make your result card'
    try {
      message = (await response.json())?.error || message
    } catch {
      // not JSON (a gateway error page)
    }
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return response.blob()
}

export function cardFilename(nickname, fallback = 'result') {
  return `nammes-${fileSlug(nickname, fallback)}.png`
}