# PWA: Service Worker and Offline Access

The app ships `manifest.webmanifest` and an `Offline.jsx` page but **no service worker** — "installable"
is the shell only, and a campus-Wi-Fi dropout wipes in-session progress state.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| SW | `vite-plugin-pwa` (Workbox): precache app shell; runtime-cache Google Fonts (stale-while-revalidate) and Storage-hosted assets |
| Offline pages | Precache + route `/offline` → `Offline.jsx` fallback for navigation failures |
| Offline content | Cache-first for last-viewed outlines/timetable PDFs (user-initiated) via `workbox-routing` |
| Install UX | `beforeinstallprompt` capture; subtle "Install the hub" chip in footer on mobile |
| Update flow | `registerType: 'prompt'` — toast "New version — reload" on SW update; no surprise reloads mid-quiz |
| Quiz guard | SW never intercepts `/api/quiz*` or `/api/cbt*`; network-only for those |

### Out

- **Full offline editing/sync.** Outbox sync for offline submissions is a Phase 2 product decision.
- **iOS-perfect install.** iOS PWA limits apply; document expectations.

---

## 2. The problem

Campus Wi-Fi is lossy; the library basement is worse. Students printing course outlines and timetables before lectures should get them offline. `Offline.jsx` already exists unwired — the shell is 90% done; the worker is missing.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Plugin | `vite-plugin-pwa` with Workbox `generateSW` | Zero hand-written SW; maintained strategy |
| Precache | Entry + route chunks + fonts + offline page (not the 9 MB PDF — CDN cache instead) | Bounded install size |
| API routes | `NetworkOnly` for `/api/*` | Stale quiz state is corruption, not convenience |
| Prompt UX | Update toast only when no quiz in progress (check route prefix) | Mid-exam reloads are unacceptable |
| Test | Playwright: go offline → navigate → offline page shows; online → SW registered | Regression guard |

## 4. The change

Add dev dep + config (`strategies: 'generateSW'`, `registerType: 'prompt'`, `workbox.runtimeCaching`); `src/lib/swUpdate.js` listens for `needRefresh` and shows a toast suppressed on quiz/CBT routes; `main.jsx` registers via plugin virtual module; `Offline.jsx` linked in `manifest` + `navigateFallbackDenylist: [/^\/api\//]`.

## 5. Verification

1. Lighthouse PWA audit ≥ 90; install prompt appears on Android Chrome.
2. Offline navigation to `/` renders the offline page; outlines cached after one view.
3. Reload during quiz does NOT silently drop answers (check handler behavior with SW active).

## 6. Risk

Stale app-shell loop (old index.html referencing purged chunks) — mitigate with `cleanupOutdatedCaches` + content-hashed assets (already hashed) + prompt-reload flow. iOS standalone mode quirks documented in ADMIN.md.
