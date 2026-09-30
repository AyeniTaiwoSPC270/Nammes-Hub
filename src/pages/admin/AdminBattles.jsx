import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useToast } from '../../lib/ToastContext'
import Breadcrumbs from '../../components/Breadcrumbs'
import Button from '../../components/ui/Button'
import ErrorState from '../../components/ui/ErrorState'
import { Avatar } from '../../components/quiz/QuizParts'
import { formatScore } from '../../data/quiz'

// Battle mode for admins: the ranking (remove a player's entry or reset everything) and the latest battles.
// The tables are admin-read only; removing ranking entries is allowed by an admin-only delete policy.

async function fetchRatings() {
  const { data, error } = await supabase.from('quiz_battle_ratings').select('*').order('rating', { ascending: false }).limit(100)
  if (error) throw error
  return data
}

async function fetchRecentBattles() {
  const { data, error } = await supabase
    .from('quiz_battles')
    .select('id, mode, code, state, winner_slot, forfeit, created_at, finished_at, quizzes(title), quiz_battle_sides(slot, nickname, total_score, bot_skill)')
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return data
}

function sideOf(battle, slot) {
  return (battle.quiz_battle_sides ?? []).find((s) => s.slot === slot)
}

export default function AdminBattles() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const ratings = useQuery({ queryKey: ['battle_ratings'], queryFn: fetchRatings })
  const battles = useQuery({ queryKey: ['battle_recent'], queryFn: fetchRecentBattles })
  const [confirmReset, setConfirmReset] = useState(false)

  const remove = useMutation({
    mutationFn: async (tagHash) => {
      const { data, error } = await supabase.from('quiz_battle_ratings').delete().eq('tag_hash', tagHash).select('tag_hash')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Nothing was removed. Your account may not have admin access.')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['battle_ratings'] })
      toast.success('Removed from the ranking.')
    },
    onError: (e) => toast.error(e.message),
  })
  const reset = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('quiz_battle_ratings').delete().neq('tag_hash', '')
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['battle_ratings'] })
      setConfirmReset(false)
      toast.success('Ranking reset.')
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'Admin', to: '/admin' }, { label: 'Live Quiz', to: '/admin/quizzes' }, { label: 'Battles' }]} />
      <h1 className="text-3xl font-bold text-ink-900">Battles</h1>
      <p className="text-ink-muted">
        Turn battles on for a quiz in its editor. Players start at <code>/battle</code>. The ranking follows each player&apos;s device (it is not an account) and never includes bots.
      </p>

      <section className="mt-8" aria-label="Ranking">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-ink-900">Ranking</h2>
          {(ratings.data?.length ?? 0) > 0 &&
            (confirmReset ? (
              <span className="flex items-center gap-2">
                <span className="text-sm text-ink-muted">Clear everyone&apos;s rating?</span>
                <Button variant="destructive" size="sm" disabled={reset.isPending} onClick={() => reset.mutate()}>Yes, reset</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
              </span>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setConfirmReset(true)}>Reset ranking</Button>
            ))}
        </div>
        {ratings.isError ? (
          <ErrorState message="Couldn't load the ranking." onRetry={ratings.refetch} />
        ) : ratings.isLoading ? (
          <p className="mt-2 text-ink-muted">Loading…</p>
        ) : ratings.data.length === 0 ? (
          <p className="mt-2 text-ink-muted">Nobody is ranked yet. A player appears after a finished battle against another real player.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-low text-xs uppercase tracking-[.05em] text-ink-muted">
                <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Player</th><th className="px-3 py-2">Rating</th><th className="px-3 py-2">W</th><th className="px-3 py-2">L</th><th className="px-3 py-2">D</th><th className="px-3 py-2" /></tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {ratings.data.map((r, i) => (
                  <tr key={r.tag_hash}>
                    <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2"><span className="flex items-center gap-2"><Avatar name={r.nickname} avatarId={r.avatar_id} mood="static" className="h-8 w-8" />{r.nickname}</span></td>
                    <td className="px-3 py-2 font-bold tabular-nums">{r.rating}</td>
                    <td className="px-3 py-2 tabular-nums">{r.wins}</td>
                    <td className="px-3 py-2 tabular-nums">{r.losses}</td>
                    <td className="px-3 py-2 tabular-nums">{r.draws}</td>
                    <td className="px-3 py-2 text-right"><Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(r.tag_hash)}>Remove</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10" aria-label="Recent battles">
        <h2 className="text-xl font-bold text-ink-900">Recent battles</h2>
        {battles.isError ? (
          <ErrorState message="Couldn't load the battles." onRetry={battles.refetch} />
        ) : battles.isLoading ? (
          <p className="mt-2 text-ink-muted">Loading…</p>
        ) : battles.data.length === 0 ? (
          <p className="mt-2 text-ink-muted">No battles yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hairline rounded-xl border border-hairline">
            {battles.data.map((b) => {
              const a = sideOf(b, 'a')
              const s = sideOf(b, 'b')
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold text-ink-900">{b.quizzes?.title ?? 'Deleted quiz'}</span>
                    <span className="ml-2 text-xs uppercase tracking-[.05em] text-ink-muted">{b.mode === 'duel' ? 'Live duel' : 'Challenge'} · {b.code}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={b.winner_slot === 'a' ? 'font-bold' : ''}>{a?.nickname ?? '?'} <span className="tabular-nums text-ink-muted">{formatScore(a?.total_score ?? 0)}</span></span>
                    <span className="text-ink-muted">vs</span>
                    <span className={b.winner_slot === 'b' ? 'font-bold' : ''}>{s ? `${s.nickname}${s.bot_skill ? ' (bot)' : ''}` : 'nobody yet'} <span className="tabular-nums text-ink-muted">{s ? formatScore(s.total_score) : ''}</span></span>
                    <span className="rounded-full bg-hairline/60 px-2 py-0.5 text-xs font-bold">{b.state}{b.forfeit ? ' · forfeit' : ''}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
