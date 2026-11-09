# PWA: Service Worker and Offline Access — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A real, installable, offline-capable app shell: last-viewed outlines and the CBT/practice shell work without network; `/offline` renders when navigation fails.

**Architecture:** `vite-plugin-pwa` (Workbox) precaches entry + fonts + offline page; runtime caching for fonts and Storage assets; NetworkOnly for `/api/*`; `navigateFallback` to `/offline`; update toast suppressed on quiz/CBT routes.

**Tech Stack:** `vite-plugin-pwa` + Workbox (dev-deps, free), `Offline.jsx` (exists), `manifest.webmanifest` (exists, linked in index.html).

**Spec:** `docs/superpowers/specs/2026-11-09-pwa-offline-design.md`

## Global Constraints

- `/api/*` is never served from cache. Stale quiz state is worse than no state.
- Precache budget ≤ 2 MB (entry + fonts); the 9 MB handbook stays on the network (Storage CDN).
- Prompt pattern (`registerType: 'prompt'`) — never auto-reload a page with a live quiz in it.
- Maskable icons: reuse `public/logo-small.png` / `logo.png` — no new artwork demanded.

---

## Task 1: Plugin

- [ ] `npm install -D vite-plugin-pwa`
- [ ] `vite.config.js`: add `VitePWA({ registerType: 'prompt', includeAssets: ['favicon.svg', 'logo-small.png'], manifest: false, // keep public/manifest.webmanifest
 workbox: { navigateFallback: '/offline', navigateFallbackDenylist: [/^\/api\//], runtimeCaching: [ { urlPattern: /^https:\/\/fonts\.googleapis\.com/, handler: 'StaleWhileRevalidate', options: { cacheName: 'gfonts-css', expiration: { maxEntries: 8, maxAgeSeconds: 2592000 } } }, { urlPattern: /^https:\/\/fonts\.gstatic\.com/, handler: 'CacheFirst', options: { cacheName: 'gfonts-files', expiration: { maxEntries: 16, maxAgeSeconds: 31536000 } } } ], cleanupOutdatedCaches: true, clientsClaim: true } })`
- [ ] Confirm `dist/sw.js` generates; `manifest.webmanifest` unchanged (index.html link already present — verify during build).

## Task 2: Registration + update flow

**Files:** Create `src/lib/swUpdate.js`; Modify `src/main.jsx`

- [ ] `swUpdate.js`: listens to the plugin's `virtual:pwa-register` `needRefresh` → `useToast().info('A new version is available', { sticky: true, actionLabel: 'Reload', onAction: () => updateSW(true) })` — but **skip when `location.pathname` starts with `/play`, `/host`, `/cbt`** (a live game must never reload under you).
- [ ] `main.jsx`: `if (import.meta.env.PROD) { import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })); }` — keep out of dev.

## Task 3: Offline page polish

- [ ] `Offline.jsx` already exists — confirm it offers retry + links to cached outlines (if any cached) and is reachable at `/offline` (`App.jsx` route exists — verified). Copy pass: "You're offline — saved outlines still work."

## Task 4: Verify

- [ ] `npm run build && npx vite preview` → DevTools → Application: SW registered, manifest ok, no console errors.
- [ ] Offline toggle → navigate to `/` → offline page or cached shell renders; `/api/health` correctly fails offline (no fake data).
- [ ] Lighthouse PWA ≥ 90.
- [ ] Reload behavior on `/cbt`: no surprise reload prompt ever (test manually).

## Rollback

Remove the plugin + import; old clients get the old uncached app on next visit (SW itself stays until unregistered — add a one-line note in ADMIN.md for "how to force-unregister: clear site data").
