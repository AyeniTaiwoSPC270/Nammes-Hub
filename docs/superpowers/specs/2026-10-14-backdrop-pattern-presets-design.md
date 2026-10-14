# Backdrop pattern presets — design

**Date:** 2026-10-14
**Status:** approved
**Builds on:** `2026-10-13-backdrop-prop-editor-design.md`

## 1. Goal

Add ten ready-made ways to arrange the props in the Quiz Design Studio's Backdrop tab, and a bulk colour action in the selected-prop inspector. Five choices create decorative repeats; five create looser compositions. Admins can still drag and edit props after applying a preset.

## 2. Decisions

| Decision | Behaviour |
|---|---|
| Ten fixed, built-in styles | Five decorative repeats plus five prop arrangements; no uploads or custom preset saving. |
| Styles apply to the selected prop pattern | They work for the six editable prop patterns: `math`, `notes`, `stars`, `hexagons`, `rings`, and `party`. Tiled patterns, uploaded images, and Plain do not show this picker. |
| Select, then Apply | Choosing a tile selects it. **Apply selected style** changes the draft only after the explicit button press. |
| Apply changes positions only | Existing props keep their key, size, rotation, colour, and hidden state. No props are added or removed. Their `x`/`y` positions are deterministically replaced by the selected style. |
| Layouts remain per-pattern | Only `backdropLayout[currentPattern]` is changed. Arrangements for other patterns are untouched. |
| Presets are applied into the existing theme field | The result is ordinary `backdropLayout` data. No preset name or new database field is saved. Manual editing and Save look continue to work as they do now. |
| Bulk colour targets the active pattern | The inspector gains **Apply this colour to all N props**. It copies the selected prop's explicit colour to every prop in the current pattern, including hidden props. Other patterns are not recoloured. |
| Existing per-prop colour control remains | Swatches, custom hex, and Inherit continue to edit only the selected prop. Bulk colour is an additional explicit action. |

## 3. The ten styles

### Decorative repeats

1. **Even grid** — uniform rows and columns.
2. **Staggered rows** — alternating rows offset by half a column.
3. **Diagonal repeat** — repeated marks arranged along diagonal bands.
4. **Alternating line** — props arranged in offset lines with an alternating phase.
5. **Diamond lattice** — an evenly spaced diamond/hexagonal lattice.

### Prop arrangements

6. **Four corners** — props distributed toward the corners and edges.
7. **Bottom sweep** — props arranged along the lower edge.
8. **Left cluster** — props weighted toward the left side.
9. **Center burst** — props radiate around the centre.
10. **Open & sparse** — props spread widely with generous clear space.

Every style accepts the current props array and returns the same number of props with stable integer positions clamped to 0–100. The calculation is deterministic: applying the same style to the same props produces the same layout. It must behave with glyph props and shape props; its geometry does not depend on a particular glyph or shape key.

## 4. Picker and application flow

- Place a **Pattern picker** in the existing Backdrop tab, near the current pattern and prop controls.
- Group the tiles under **Decorative repeats · 5** and **Prop arrangements · 5**. Each tile has a small visual thumbnail and a short name. Selecting a tile visibly marks it as selected but does not immediately move props.
- **Apply selected style** applies the selected style to the current pattern's current layout, using `defaultBackdropProps(pattern)` when that pattern has not yet been edited.
- Applying a style updates the studio draft and live preview immediately. It does not save to Supabase; the existing Save look action remains the commit point.
- After application, the props remain individually editable with the existing drag, keyboard, inspector, hide, and delete controls. Applying another style replaces their positions again.
- The existing Reset pattern action continues to restore that pattern's original default layout; it is not renamed or replaced.
- Do not persist a preset id. On reload the actual prop layout is restored from `backdropLayout`; it can be edited or a preset can be applied again.

## 5. Bulk colour flow

- Add the bulk action directly below the existing colour swatches/custom picker in `BackdropPropInspector`.
- The action label includes the active pattern's prop count, for example **Apply this colour to all 18 ring props**.
- Enable the action only when the selected prop has an explicit valid colour (`c`). Choosing a swatch or custom colour on the selected prop supplies that colour; Inherit removes it from the selected prop and disables the bulk action until a colour is chosen again.
- Clicking the action updates `c` on all props in the active pattern, including hidden props, while preserving every other prop field. It leaves all other pattern layouts unchanged.
- The preview reflects the change immediately. As with other studio changes, it remains a draft until Save look.

## 6. Data and implementation boundary

The theme schema already contains `backdropLayout`; no migration or additional saved field is needed. Add a static preset catalogue and a pure application helper alongside the existing pure backdrop-layout helpers in `api/_lib/quizTheme.js`. Keeping the calculation pure lets tests assert deterministic coordinates and prevents UI and sanitisation from inventing different layout rules.

The Backdrop tab owns temporary picker selection and passes an applied layout through its existing draft update path. `BackdropPropInspector` can receive the active layout and a bulk-colour callback (or equivalent props) from the studio. `QuizBackdrop` remains a renderer only: it receives ordinary theme data and needs no preset/editing state. The result-card renderer remains unchanged and continues to ignore `backdropLayout`.

## 7. Tests

- Pure preset tests cover all ten ids, deterministic output, same prop count, integer/clamped coordinates, preservation of non-position fields, and distinct examples for repeats versus compositions.
- Studio tests verify the picker is available for all six prop patterns, grouped into 5 + 5 choices, hidden for non-prop patterns, and changes only the active pattern's draft layout after Apply.
- Inspector tests verify bulk colour applies the selected explicit colour to every active-pattern prop (including hidden ones), leaves other patterns unchanged, and preserves non-colour fields. Inherit disables the bulk action.
- Existing quiz backdrop and saved-look tests remain the regression checks for ordinary rendering and theme persistence.

## 8. Out of scope and real-session checks

- Saving, editing, importing, or naming custom patterns.
- Recolouring every prop across every backdrop pattern with one action.
- Adding or removing props as part of a preset.
- Changing tile patterns (`dots`, `grid`, `stripes`, `waves`) or photo/plain backdrops.
- Result-card layout changes.

The thumbnails and formulas need unit tests, but how the ten layouts read on a real projector and phone, and colour contrast across all themes, still need a Supabase login and a real quiz session.
