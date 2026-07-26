# Flat illustrations for NAMMES Hub

Date: 2026-07-26

## Problem

The site currently reads as flat and bland — the design system deliberately uses no imagery anywhere except one decorative circle on the Home hero (per `DESIGN_SYSTEM.md`: *"backgrounds are flat, no gradients/imagery/patterns anywhere except the one decorative shape"*). The user wants to add imagery to feel more human, and considered stock/photorealistic AI photos, but those risk looking generic or triggering the "uncanny AI stock photo" tell — especially for an audience (engineering students) equipped to spot it.

## Decision

Add a small set of custom, AI-generated **flat illustrations** (not photos) in three spots: the Home hero, news/event cards, and the Resources/Outlines level-picker tiles. Flat illustration keeps the existing geometric/color-fill design language intact (recolorable, no uncanny-valley risk) while adding visual warmth. This supersedes the "no imagery" rule in `DESIGN_SYSTEM.md`, which will be rewritten rather than left contradicting the code.

Images are generated externally by the user (not in this session) using locked prompts below, so today's implementation wires up the component support, mapping, and placement, with lightweight inline-SVG placeholders standing in until real files are dropped in — the same pattern already used for Exco avatars (initials-in-circles until real photos exist).

## Scope

| Spot | Treatment | Files touched |
|---|---|---|
| Home hero | One wide illustration, positioned right side of the hero on desktop (`sm:` and up), hidden on mobile to keep the hero text-first on small screens | `src/pages/Home.jsx` |
| News cards (Home) | Small square icon per category matching the 6 eyebrows already in use: Academics, Governance, Welfare, Industry, Call for papers, Resources | `src/components/ui/Card.jsx`, `src/pages/Home.jsx` |
| Event cards | No category taxonomy exists yet (`Events.jsx` eyebrows are dates, not categories) — use 2 generic tone-matched icons, one per existing `tone` value (`orange`, `green`) | `src/components/ui/Card.jsx`, `src/pages/Events.jsx` |
| Resources/Outlines level tiles | One icon per level (100–500) — same 5 levels, shared between both pages since `Resources.jsx` re-exports `LEVELS` from `data/outlines.js` | `src/pages/Outlines.jsx`, `src/pages/Resources.jsx` |

Out of scope: Exco grid (already has a documented placeholder pattern — real photos, not illustrations, are the stated plan there), News/NewsDetail/Opportunities/Admin (still `PagePlaceholder`, no layout to add images to yet — don't invent one, per existing project convention).

## Component change: `Card`

New optional prop: `image: { src, alt }`.
- Renders at the top of the card, full width, fixed aspect ratio (`aspect-[4/3]` for category-icon usage — square-ish icon on a rounded backdrop), `object-cover`, rounded to match the card's top corners (`rounded-t-lg`, 24px, mirroring the card's own `rounded-lg`).
- Omitted `image` = current behavior, fully unchanged (no breaking change to existing Card usages that don't pass it).
- Decorative only: when `image` is passed, render `<img src={image.src} alt="" aria-hidden="true" />` — never surface `image.alt` as real alt text, since the information (category eyebrow, level number) is already visible as text next to it. The `alt` field is accepted for future-proofing but intentionally not wired to a real `alt` attribute today.

## Asset pipeline

`src/lib/illustrations.js` — single source of truth mapping key → component/asset, so pages don't duplicate lookup logic:

```js
export const CATEGORY_ICONS = {
  Academics: AcademicsIcon,
  Governance: GovernanceIcon,
  Welfare: WelfareIcon,
  Industry: IndustryIcon,
  'Call for papers': CallForPapersIcon,
  Resources: ResourcesIcon,
}

export const LEVEL_ICONS = {
  '100': Level100Icon,
  '200': Level200Icon,
  '300': Level300Icon,
  '400': Level400Icon,
  '500': Level500Icon,
}

export const EVENT_TONE_ICONS = {
  orange: EventOrangeIcon,
  green: EventGreenIcon,
}
```

**Today:** each `*Icon` above is a small inline-SVG React component (hand-authored flat shape, brand colors) living in `src/components/illustrations/`, acting as the placeholder.

**Later:** when the user brings back real generated art (`src/assets/illustrations/*.png` or `.webp`), each `*Icon` entry gets swapped for `<img src={realFile} />` — a one-line change per asset in `illustrations.js`, no changes needed in `Home.jsx`/`Events.jsx`/`Outlines.jsx`/`Resources.jsx` since they only ever reference the map.

## Style lock (applies to every generated image + placeholder)

Flat 2D vector-style illustration. No gradients, no strokes/outlines, no photorealism, no embedded text/lettering. Transparent background. Centered composition, generous even padding. Palette restricted to existing design tokens — pick 2–3 per image, never all at once:
- `green-700` `#127a3e`
- `green-900` `#0b2417`
- `green-100` `#e2f7ea`
- `orange-500` `#ff5a1f`
- `orange-100` `#fff0e6`
- white `#ffffff`

### Locked prompts

**Hero** (landscape, wide aspect ratio):
> Flat 2D vector illustration of a stylized metallurgical engineering scene — a student examining a molten-metal pour from a simplified crucible/furnace shape, geometric sparks. No gradients, no outlines, no text, transparent background. Colors: primarily orange #ff5a1f with green #127a3e accents. Playful but professional, centered, generous padding.

**Category icons** (square, 1:1, single centered icon on a soft color backdrop):
- Academics — open book or graduation cap. Green-700 shape on green-100 backdrop.
- Governance — ballot box or gavel. Orange-500 shape on orange-100 backdrop.
- Welfare — heart-in-hand or care package. Green-700 shape on green-100 backdrop.
- Industry — factory/gear/hard-hat. Orange-500 shape on orange-100 backdrop.
- Call for papers — document with pen. Green-700 shape on green-100 backdrop.
- Resources — folder or shared-drive icon. Orange-500 shape on orange-100 backdrop.

**Level icons** (square, 1:1, progression theme from first year to final year):
- 100L — seedling/sprout. Green-700 on green-100.
- 200L — open book. Green-700 on green-100, orange-500 accent detail.
- 300L — gear or lab flask. Orange-500 on orange-100.
- 400L — hard-hat/factory (industrial attachment). Orange-500 on orange-100.
- 500L — graduation cap or trophy (final year project). Green-700 with orange-500 accent.

**Event tone icons** (square, 1:1, must read clearly against the card's own background):
- `tone="green"` card has a solid green-700 fill — icon must be white/light so it's visible. Calendar-with-pin shape, white on transparent.
- `tone="orange"` card has a light orange-100 fill — icon uses orange-600 or green-900 shape, calendar-with-star, on transparent.

14 images total: 1 hero + 6 category + 5 level + 2 event-tone.

## DESIGN_SYSTEM.md updates

- Rewrite the "Visual rules" line that currently bans imagery/patterns — replace with the flat-illustration rule and style-lock above.
- Add a new "Illustration" section documenting: the style lock, palette restriction, the 14-image inventory, file convention (`src/assets/illustrations/`, `src/components/illustrations/` for placeholders), and the swap process (placeholder component → real asset import in `illustrations.js`).
- Update the `Card` component doc to list the new `image` prop.
- Update the "What's deliberately out of scope for v1" section: remove/adjust the icon-set line since illustration icons are now in scope (icons-as-structural-navigation are still out of scope — this is decorative imagery, not an icon system for UI controls).

## Accessibility

All 14 images are decorative — the information they sit next to (category eyebrow text, level number, hero heading/copy) is already conveyed in text. Every image renders with `alt=""` and `aria-hidden="true"`, not descriptive alt text, so screen readers don't get redundant announcements.

## Testing

No new test coverage needed — this is presentational/markup only, no new logic branches. Existing `Card` usages without `image` must continue rendering identically (visual regression by inspection, not a new automated test).
