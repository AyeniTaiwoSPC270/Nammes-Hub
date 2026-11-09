# Mobile Quiz Hosting and Responsiveness

Hosting a live quiz from a phone — the realistic scenario for a lecturer or president running a pub
quiz from the lectern — is unverified; the 1647-line HostQuiz was desktop-first.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Responsiveness audit | HostQuiz/PlayBattle on 360 px — controls reachable one-handed, no horizontal scroll |
| Co-host mode | Second screen joins as `host-viewer` (read-only leaderboard + question preview) — the "projector + phone" pattern |
| Big-touch targets | ≥ 44 px for start/lock/reveal/next; destructive "end quiz" double-confirm |
| Audio cue | Distinct sounds for lock-in/reveal so the host need not watch the screen constantly |
| Vibration | `navigator.vibrate(50)` on phase change where supported |

### Out

- **Native app.** PWA covers it.
- **Multi-host write access.** One controlling host per session; viewers are read-only.

---

## 2. The problem

Quiz nights happen in lecture theatres with a projector and one phone/laptop. Today's host UI was built at ≥ 1280 px; buttons shrink, leaderboards overflow. A host who cannot lock answers from the lectern table breaks the room's pacing — the #1 live-event failure mode.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Co-host | `quiz_player_tokens` gains `role='host_viewer'`; viewers get state via the existing quiz-state channel | Zero new realtime infra; read-only is one token scope |
| Layout | Single-column stacked controls ≤ 768 px; sticky action bar (Lock / Reveal / Next) bottom-fixed | Thumb-reachable, projector-safe |
| Safety | "End quiz" requires typing the quiz code or hold-to-confirm 1.5 s | Prevents fat-finger game-overs |
| Feedback | Short SFX + optional vibrate per phase change | Eyes-free pacing |

## 4. The change

CSS/Tailwind pass on HostQuiz + PlayBattle; `host_viewer` role in token mint (`quiz-join` handler) and a read-only route `/host/:code/view`; sticky action bar component; SFX via existing `quizSound`; E2E Playwright project at 360×740 viewport.

## 5. Verification

1. Playwright 360 px run: host a full 5-question quiz end-to-end with touch events.
2. Physical test: two devices — host phone + viewer phone — stay in sync ≤ 1 s on same network.
3. No horizontal overflow at 320 px (CLS/scrollWidth assertion).

## 6. Risk

Read-only viewers increase realtime fan-out during a live quiz — viewers use 2 s poll (SWR cache), not push. Co-host tokens must never reach mutation handlers; enforce role checks server-side in every quiz mutation, not just UI-hidden buttons.
