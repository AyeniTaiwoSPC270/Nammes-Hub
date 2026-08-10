# News Photo-Forward Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make News photos the dominant visual element (full-bleed cover photos) instead of 64px icons, on News, Home's news teaser, and NewsDetail, without touching any other `Card` consumer.

**Architecture:** Add an opt-in `imageVariant="cover"` mode to the shared `Card` component (default stays `"icon"`, today's exact behavior, unchanged). News and Home switch their `Card` usages to the new variant and drop the category-illustration fallback (no photo → no image row, rather than a stretched icon). `NewsDetail` gets a one-line radius tweak for visual consistency. `DESIGN_SYSTEM.md` is corrected to reflect that News now uses real photos.

**Tech Stack:** React (Vite), Tailwind CSS v4 (utility classes, `aspect-*`/`object-cover`), no new dependencies.

## Global Constraints

- Design tokens only — no raw hex values in class names (`DESIGN_SYSTEM.md`: "always go through the token").
- `Card`'s default (`imageVariant="icon"` when omitted) must render byte-identical output to today's code — every existing `Card` consumer (Events, and any future icon usage) must be visually unchanged.
- All images stay decorative: `alt=""` + `aria-hidden="true"` (spec's Accessibility section) — never real alt text.
- No new automated tests — this is a presentational-only change (spec's Testing section); existing `news.test.js` coverage must keep passing untouched.
- Lint (`npm run lint`) and build (`npm run build`) must stay clean after every task — this project has no TS/type-check step, so these are the two automated correctness gates available.

---

### Task 1: `Card` component — add `imageVariant`/`imageAspect`

**Files:**
- Modify: `src/components/ui/Card.jsx`
- Modify: `DESIGN_SYSTEM.md:78-82` (Card prop docs)

**Interfaces:**
- Produces: `Card` accepts two new optional props — `imageVariant` (`'icon'` default | `'cover'`) and `imageAspect` (`'standard'` default | `'video'`, only meaningful when `imageVariant="cover"`). All other props (`eyebrow`, `title`, `meta`, `children`, `padded`, `tone`, `className`, `image: { src }`) are unchanged in name, type, and behavior.

- [ ] **Step 1: Read the current file to confirm line numbers before editing**

Run: view `src/components/ui/Card.jsx` — confirm it still matches:
```jsx
export default function Card({ eyebrow, title, meta, children, padded = true, tone = 'neutral', className = '', image }) {
  const t = tones[tone] || tones.neutral

  return (
    <div className={['flex flex-col gap-2 rounded-lg', t.bg, className].join(' ')}>
      <div className={['flex flex-col gap-2', padded ? 'p-6' : ''].join(' ')}>
        {image && (
          <img src={image.src} alt="" aria-hidden="true" className="h-16 w-16 object-contain" />
        )}
```
If it doesn't match, stop and re-read the whole file before proceeding — the edit below assumes this exact shape.

- [ ] **Step 2: Add the `imageVariant`/`imageAspect` branch**

Replace the full contents of `src/components/ui/Card.jsx` with:

```jsx
const tones = {
  neutral: { bg: 'bg-surface', eyebrow: 'text-ink-muted', title: 'text-green-900', meta: 'text-ink-muted', body: 'text-ink' },
  green: { bg: 'bg-green-700', eyebrow: 'text-orange-400', title: 'text-white', meta: 'text-white/70', body: 'text-white/90' },
  orange: { bg: 'bg-orange-100', eyebrow: 'text-orange-600', title: 'text-green-900', meta: 'text-ink-muted', body: 'text-ink' },
}

const imageAspects = {
  standard: 'aspect-[4/3]',
  video: 'aspect-[16/9]',
}

export default function Card({
  eyebrow,
  title,
  meta,
  children,
  padded = true,
  tone = 'neutral',
  className = '',
  image,
  imageVariant = 'icon',
  imageAspect = 'standard',
}) {
  const t = tones[tone] || tones.neutral

  return (
    <div className={['flex flex-col gap-2 rounded-lg', t.bg, className].join(' ')}>
      {image && imageVariant === 'cover' && (
        <img
          src={image.src}
          alt=""
          aria-hidden="true"
          className={['w-full rounded-t-lg object-cover', imageAspects[imageAspect] || imageAspects.standard].join(' ')}
        />
      )}
      <div className={['flex flex-col gap-2', padded ? 'p-6' : ''].join(' ')}>
        {image && imageVariant === 'icon' && (
          <img src={image.src} alt="" aria-hidden="true" className="h-16 w-16 object-contain" />
        )}
        {eyebrow && (
          <div className={['font-mono text-xs uppercase tracking-[.04em] font-semibold', t.eyebrow].join(' ')}>
            {eyebrow}
          </div>
        )}
        {title && <h3 className={['text-xl m-0', t.title].join(' ')}>{title}</h3>}
        {meta && <div className={['font-mono text-sm', t.meta].join(' ')}>{meta}</div>}
        {children && <div className={['text-base leading-relaxed', t.body].join(' ')}>{children}</div>}
      </div>
    </div>
  )
}
```

Note the `imageVariant === 'icon'` guard added around the existing icon `<img>` — this is required so a caller can never accidentally get both an icon image and a cover image rendered at once, but since every existing caller omits `imageVariant` (defaults to `'icon'`), this guard is always true for them and changes nothing about their output.

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed with no errors (no consumer passes `imageVariant` yet, so this is a pure additive change).

- [ ] **Step 4: Update `Card` prop docs in `DESIGN_SYSTEM.md`**

In `DESIGN_SYSTEM.md`, find this line (around line 78):
```
Props: `eyebrow`, `title`, `meta`, `children`, `padded` (default true), `tone` (`neutral`|`green`|`orange`), `image` (`{ src }`, optional).
```
Replace with:
```
Props: `eyebrow`, `title`, `meta`, `children`, `padded` (default true), `tone` (`neutral`|`green`|`orange`), `image` (`{ src }`, optional), `imageVariant` (`icon` default | `cover`), `imageAspect` (`standard` default | `video`, only relevant when `imageVariant="cover"`).
```

Then find the `image` prop description (around line 82):
```
- `image`: renders as a 64×64 badge (`object-contain`, not cropped) above the eyebrow, inside the card's own padding. The illustration assets are self-contained circular badges (icon + soft circle backdrop) — `object-contain` keeps the full badge intact rather than cropping it into a photo-style banner. Always decorative (`alt=""`, `aria-hidden`) — the category/context is already conveyed by the eyebrow text next to it. See "Illustration" below for the asset set.
```
Replace with:
```
- `image` + `imageVariant="icon"` (default): renders as a 64×64 badge (`object-contain`, not cropped) above the eyebrow, inside the card's own padding. The illustration assets are self-contained circular badges (icon + soft circle backdrop) — `object-contain` keeps the full badge intact rather than cropping it into a photo-style banner. Always decorative (`alt=""`, `aria-hidden`) — the category/context is already conveyed by the eyebrow text next to it. See "Illustration" below for the asset set.
- `image` + `imageVariant="cover"`: renders full-bleed above the card's padded content, `object-cover`, `rounded-t-lg` to match the card's own `rounded-lg`. Fixed aspect ratio via `imageAspect`: `standard` (4:3, default — grid cards) or `video` (16:9 — featured/hero cards). Used for real uploaded photos (News) rather than decorative illustrations; if `image` is omitted, no image row renders at all — never falls back to a stretched icon. Always decorative (`alt=""`, `aria-hidden`).
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Card.jsx DESIGN_SYSTEM.md
git commit -m "$(cat <<'EOF'
feat: add cover imageVariant to Card for full-bleed photos

News/Home currently squash uploaded photos into Card's 64px icon
treatment. Adds an opt-in imageVariant="cover" mode; the default
(imageVariant="icon") is byte-identical to today's behavior so
Events and other consumers are unaffected.
EOF
)"
```

---

### Task 2: News list (`src/pages/News.jsx`) — cover photos, 2-col grid

**Files:**
- Modify: `src/pages/News.jsx`
- Modify: `DESIGN_SYSTEM.md:30` (Visual rules line), `DESIGN_SYSTEM.md:137` (News page description)

**Interfaces:**
- Consumes: `Card`'s `imageVariant`/`imageAspect` props from Task 1 (`imageVariant="cover"`, `imageAspect="video"|"standard"`).

- [ ] **Step 1: Remove the now-unused `categoryImage` import**

In `src/pages/News.jsx`, this line:
```js
import { categoryImage } from '../lib/illustrations'
```
gets deleted entirely (no other symbol from `../lib/illustrations` is used in this file).

- [ ] **Step 2: Switch the featured `Card` to a stacked cover photo**

Replace:
```jsx
          <Link to={`/news/${featured.id}`} className="block">
            <Card
              tone={featured.tone}
              eyebrow={featured.category}
              title={featured.title}
              meta={featured.date}
              image={featured.image_url ? { src: featured.image_url } : categoryImage(featured.category)}
            >
              {featured.body}{' '}
              {featured.badge_tone && <Badge tone={featured.badge_tone}>{featured.badge_label}</Badge>}
            </Card>
          </Link>
```
with:
```jsx
          <Link to={`/news/${featured.id}`} className="block">
            <Card
              tone={featured.tone}
              eyebrow={featured.category}
              title={featured.title}
              meta={featured.date}
              image={featured.image_url ? { src: featured.image_url } : undefined}
              imageVariant="cover"
              imageAspect="video"
            >
              {featured.body}{' '}
              {featured.badge_tone && <Badge tone={featured.badge_tone}>{featured.badge_label}</Badge>}
            </Card>
          </Link>
```

- [ ] **Step 3: Switch the grid to 2 columns with cover photos**

Replace:
```jsx
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((item) => (
              <Link key={item.id} to={`/news/${item.id}`} className="block">
                <Card
                  tone={item.tone}
                  eyebrow={item.category}
                  title={item.title}
                  meta={item.date}
                  image={item.image_url ? { src: item.image_url } : categoryImage(item.category)}
                >
                  {item.body}{' '}
                  {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
                </Card>
              </Link>
            ))}
          </div>
```
with:
```jsx
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rest.map((item) => (
              <Link key={item.id} to={`/news/${item.id}`} className="block">
                <Card
                  tone={item.tone}
                  eyebrow={item.category}
                  title={item.title}
                  meta={item.date}
                  image={item.image_url ? { src: item.image_url } : undefined}
                  imageVariant="cover"
                  imageAspect="standard"
                >
                  {item.body}{' '}
                  {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
                </Card>
              </Link>
            ))}
          </div>
```

- [ ] **Step 4: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed (the removed `categoryImage` import would surface as an unused-import lint error if step 1 was missed — treat that as a signal to go back and delete the import line).

- [ ] **Step 5: Update the imagery rule in `DESIGN_SYSTEM.md`**

Find this line (around line 30):
```
Visual rules: backgrounds are flat, no gradients/patterns. Imagery is limited to a small set of custom flat illustrations (see "Illustration" below) plus the one decorative shape (a solid green circle bleeding off the Home hero) — no photography, no stock imagery. Translucent blur is used exactly once — the sticky Navbar (`bg-white/95` + `backdrop-blur-sm`). Borders are flat hairlines on tables/inputs only; cards are borderless colored fills. Shadow (`shadow-sm`/`shadow-md`) reserved for floating elements — modals, dropdowns.
```
Replace with:
```
Visual rules: backgrounds are flat, no gradients/patterns. Decorative imagery (category glyphs on Events/Resources/Outlines, the Home hero) is limited to a small set of custom flat illustrations (see "Illustration" below) plus the one decorative shape (a solid green circle bleeding off the Home hero) — no stock imagery for decorative use. News is the exception: its cards show real uploaded photos full-bleed (`Card`'s `imageVariant="cover"`) as the primary content medium, not a decorative accent. Translucent blur is used exactly once — the sticky Navbar (`bg-white/95` + `backdrop-blur-sm`). Borders are flat hairlines on tables/inputs only; cards are borderless colored fills. Shadow (`shadow-sm`/`shadow-md`) reserved for floating elements — modals, dropdowns.
```

- [ ] **Step 6: Fix the stale News description in `DESIGN_SYSTEM.md`**

Find this line (around line 137, in the page-by-page rundown):
```
- **News** (`src/pages/News.jsx`) — full reverse-chronological list of `src/data/news.js`'s sample data (1 featured green Card + grid, same pattern as Home's teaser), category filter pills (`All` + the 6 `NEWS_CATEGORIES`) driven by `?category=` in the URL, each card links to `/news/:id`.
```
Replace with:
```
- **News** (`src/pages/News.jsx`) — full reverse-chronological list from Supabase (1 featured Card with a full-bleed cover photo + 2-col grid of cover-photo Cards, same pattern as Home's teaser), category filter pills (`All` + the 6 `NEWS_CATEGORIES`) driven by `?category=` in the URL, each card links to `/news/:id`.
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/News.jsx DESIGN_SYSTEM.md
git commit -m "$(cat <<'EOF'
feat: show News photos full-bleed instead of icon-sized

Switches News' featured Card and grid to imageVariant="cover" (video
aspect for the featured post, standard 4:3 for the grid), drops the
3rd grid column so photos stay readable in the 880px column, and
drops the category-illustration fallback — posts without a photo
just show the colored text block, no stretched icon.
EOF
)"
```

---

### Task 3: Home news teaser (`src/pages/Home.jsx`) — cover photos

**Files:**
- Modify: `src/pages/Home.jsx`

**Interfaces:**
- Consumes: `Card`'s `imageVariant`/`imageAspect` props from Task 1.

- [ ] **Step 1: Remove `categoryImage` from the illustrations import, keep `HERO_ILLUSTRATION`**

Replace:
```js
import { HERO_ILLUSTRATION, categoryImage } from '../lib/illustrations'
```
with:
```js
import { HERO_ILLUSTRATION } from '../lib/illustrations'
```

- [ ] **Step 2: Switch the featured news `Card` to a cover photo**

Replace:
```jsx
            <Card
              tone={featuredNews.tone}
              eyebrow={featuredNews.category}
              title={featuredNews.title}
              meta={featuredNews.date}
              image={featuredNews.image_url ? { src: featuredNews.image_url } : categoryImage(featuredNews.category)}
            >
              {featuredNews.body}{' '}
              {featuredNews.badge_tone && <Badge tone={featuredNews.badge_tone}>{featuredNews.badge_label}</Badge>}
            </Card>
```
with:
```jsx
            <Card
              tone={featuredNews.tone}
              eyebrow={featuredNews.category}
              title={featuredNews.title}
              meta={featuredNews.date}
              image={featuredNews.image_url ? { src: featuredNews.image_url } : undefined}
              imageVariant="cover"
              imageAspect="video"
            >
              {featuredNews.body}{' '}
              {featuredNews.badge_tone && <Badge tone={featuredNews.badge_tone}>{featuredNews.badge_label}</Badge>}
            </Card>
```

- [ ] **Step 3: Switch the grid-of-3 `Card`s to cover photos**

Replace:
```jsx
                <Card
                  key={item.id}
                  tone={item.tone}
                  eyebrow={item.category}
                  title={item.title}
                  meta={item.date}
                  image={item.image_url ? { src: item.image_url } : categoryImage(item.category)}
                >
                  {item.body}{' '}
                  {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
                </Card>
```
with:
```jsx
                <Card
                  key={item.id}
                  tone={item.tone}
                  eyebrow={item.category}
                  title={item.title}
                  meta={item.date}
                  image={item.image_url ? { src: item.image_url } : undefined}
                  imageVariant="cover"
                  imageAspect="standard"
                >
                  {item.body}{' '}
                  {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
                </Card>
```

Note: the grid's column classes (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) are **not** changed here — Home's teaser layout stays 3-up per the design spec, only News' full list drops to 2-up.

- [ ] **Step 4: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Home.jsx
git commit -m "$(cat <<'EOF'
feat: show Home's news teaser photos full-bleed

Matches News' cover-photo treatment (Task in
2026-08-09-news-photo-feed.md) so the teaser and the full list look
consistent. Layout (1 featured + 3-col grid) is unchanged.
EOF
)"
```

---

### Task 4: NewsDetail hero image radius

**Files:**
- Modify: `src/pages/NewsDetail.jsx`

- [ ] **Step 1: Bump the hero image radius**

Replace:
```jsx
      {post.image_url && (
        <img
          src={post.image_url}
          alt=""
          style={{ width: `${post.image_width_pct || 100}%` }}
          className="mt-6 rounded-md"
        />
      )}
```
with:
```jsx
      {post.image_url && (
        <img
          src={post.image_url}
          alt=""
          style={{ width: `${post.image_width_pct || 100}%` }}
          className="mt-6 rounded-lg"
        />
      )}
```

- [ ] **Step 2: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/pages/NewsDetail.jsx
git commit -m "fix: match NewsDetail hero image radius to new card convention"
```

---

### Task 5: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all existing tests pass, including `src/data/news.test.js` (untouched by this plan).

- [ ] **Step 2: Start the dev server**

Run: `npm run dev` (background/separate terminal — note the printed local URL, typically `http://localhost:5173`)

- [ ] **Step 3: Visually verify News (`/news`)**

Open `/news` in a browser. Confirm:
- The featured post shows a large photo on top (16:9), full width of the container, with the title/date/body in the tone-colored block below it.
- The grid below is 2 columns (not 3), each card with a photo on top (4:3, `object-cover` — cropped, not stretched or squashed).
- If any sample row has no `image_url`, its card shows only the colored text block — no broken image icon, no tiny stretched illustration.
- Category filter pills still work (click a category, list filters, URL gets `?category=`).

- [ ] **Step 4: Visually verify Home (`/`)**

Open `/`. Confirm the "What's happening in the department" section shows the same cover-photo treatment (1 featured + 3-col grid, photos full-bleed and cropped), and every other section of Home (hero, Exco grid) looks unchanged.

- [ ] **Step 5: Visually verify NewsDetail (`/news/:id`)**

Click into a news post from `/news`. Confirm the hero photo renders full-bleed with the new `rounded-lg` corner radius, and everything else on the page (breadcrumb, byline, body) is unchanged.

- [ ] **Step 6: Visually verify Events is unaffected (`/events`)**

Open `/events`. Confirm the tone icons still render at their original small icon size (`imageVariant` defaults to `"icon"` there — this page's `Card` usage was never touched) — this is the regression check for Task 1's default-behavior guarantee.

- [ ] **Step 7: Stop the dev server**

Kill the `npm run dev` process started in Step 2.
