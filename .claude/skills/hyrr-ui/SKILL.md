---
name: hyrr-ui
description: Use when building or changing any React UI in hyrr.recruiter, hyrr.jobseeker or hyrr.shared (pages, dialogs, forms, lists, cards). Gives the design tokens, shared components, state patterns and a11y checklist so UI is consistent and correct the first time.
---

# Hyrr UI conventions

## Where code goes
- Reused by both apps → `hyrr.shared/src/components/...` and export it from `hyrr.shared/src/index.ts`.
- App-specific → `hyrr.<app>/src/components/...` or `pages/`. Import shared things from `"hyrr.shared"`, never via relative paths into another workspace.
- Data + API calls live in the store (`hyrr.shared/src/store/useJobStore.ts`), not in components. Components call store actions.

## Tokens (Tailwind classes; never raw hex or `bg-white`, which breaks dark mode)
- Text: `text-txt-title` (page titles), `text-txt-heading`, `text-txt-body`, `text-txt-caption`, `text-txt-disabled`
- Surfaces: `bg-bg-primary` (page), `bg-bg-secondary`/`bg-bg-card` (cards), `bg-bg-hover`, borders `border-bg-border`
- Brand: `bg-primary`, `hover:bg-primary-hover`, `bg-primary-light`, `border-primary-border`
- Status: `text-sec-green|orange|red|blue|gray`; badges via `<Badge variant="success|warning|destructive|info|secondary|primary">`
- Type scale (both apps): page title `text-[22px]`–`text-[28px] font-bold`, card title `text-[15px]–[16px] font-semibold`, body `text-[13px]–[14px]`, meta `text-[12px]`, tiny badges `text-[11px]`. Don't go below 11px.
- Radius: cards `rounded-2xl`, inputs/buttons `rounded-xl`, chips `rounded-full`.

## Shared components (from `hyrr.shared`)
`Button`, `Input`, `Badge`, `Card`, `Dialog` (Radix: focus trap, Escape), `Dropdown`, `Tooltip`, `Skeleton`, `EmptyState`, `Table`, `Pagination`, `useToast()` → `toast(title, body, "success"|"error")`, `RichTextEditor`/`RichTextRenderer` (sanitised), `MessagesView`.

`ConfirmDialog` is currently per app: `hyrr.recruiter/src/components/layout/confirm-dialog.tsx` and `hyrr.jobseeker/src/components/ui/confirm-dialog.tsx`. Use the local one; if you need it in `hyrr.shared`, move it there and export it rather than creating a third copy.

## Every data view needs 4 states
1. Loading: `Skeleton` on first load only (don't flash spinners on background refetch).
2. Error: message + Retry calling the store action again.
3. Empty: `EmptyState` with a next step ("Create a job", "Go to Applications").
4. Data.

## Actions
```tsx
const [busy, setBusy] = useState(false)
async function onSave() {
  setBusy(true)
  try { await storeAction(input); toast("Saved", "...", "success"); onClose() }
  catch (err) { toast("Couldn't save", (err as Error).message, "error") }
  finally { setBusy(false) }
}
```
- Toast **after** the await resolves. Close dialogs only on success.
- Destructive actions use `ConfirmDialog`.
- Disable submit while busy; validate required fields before calling.

## Accessibility checklist
- Clickable things are `<button>`/`<a>`, never `div onClick`.
- Icon-only buttons have `aria-label`.
- Inputs have `<label htmlFor>` (or `sr-only` label).
- Hover-only controls are also visible on focus (`group-focus-within:opacity-100`).
- Dialogs use the shared `Dialog`.

## Layout
- Mobile first: no horizontal page overflow at 375px; wide content (kanban, tables) scrolls inside its own container.
- Sidebars become drawers below `lg`.
- Tailwind classes used only in `hyrr.shared` work because each app's `index.css` has `@source "../../hyrr.shared/src";`.

## Before finishing
`npx tsc --noEmit -p <app>/tsconfig.app.json` and `npm run build --workspace=<app>`, plus `npx prettier --write` on touched files.


## Forms
Follow the `hyrr-validation` skill: zod rules from `hyrr.shared` (same as the backend DTO), inline `<FieldError>` under each field (not toasts), structured inputs for money and dates.

## Motion & premium feel (Apple-style: quick, smooth, no bounce)
- Curves: `--ease-apple` (cubic-bezier(.32,.72,0,1)) for UI state, `--ease-out-expo` for entrances. In TS: `EASE_APPLE`, `EASE_OUT_EXPO`, `SPRING_SMOOTH` from `hyrr.shared`. Durations 150–400 ms; never springy overshoot.
- Shared components already animate: `Button` (press scale, lift, shine on primary/danger), `Card` (cursor glow; `hoverEffect` lifts), `Dialog` (frosted backdrop + blur-in), `Toast`, dropdowns, `Skeleton` (shimmer), `Input` (focus glow). Prefer them over hand-rolled markup.
- Utilities (index.css): `hover-lift`, `press`, `spotlight` (glow follows the cursor; `installPointerEffects()` runs in main.tsx), `btn-shine`, `glass`, `stagger` (children rise in sequence), `ring-gradient`, `skeleton-shimmer`, `app-canvas` (ambient wash on <main>).
- Components (`components/ui/motion.tsx`): `PageTransition` (wraps the active view in App.tsx), `ActiveIndicator` (sliding pill: nav items and segmented tabs; parent needs `relative isolate`), `AnimatedNumber` (stats, balances), `Reveal` (in-view entrance).
- Everything respects `prefers-reduced-motion`. Animate transform/opacity (and short blur); never animate layout-heavy properties on large lists.
- Scrolling: each app's `<main>` uses `useSmoothScroll(mainEl, activeView)` (Lenis, wheel only, nested scroll areas stay native, resets to top on view change). Inner scroll areas use `overflow-y-auto` (gets `overscroll-behavior: contain`); add `data-lenis-prevent` only if a custom widget fights the wheel.

## Tones (colour with meaning)
- Never hard-code `sec-*`/hex colours for statuses or categories. Pick a tone from `hyrr.shared/src/lib/tones.ts`: `stageTone` (Applied blue, In process amber, Interviewing violet, Offer emerald, Rejected rose, Archived/Withdrawn slate), `jobStatusTone`, `eventTone`, `notificationTone`, `documentTone`, `scoreTone`, `jobColorTone`, or `TONE_CYCLE` for equal items.
- Apply with `toneClass(tone)` + `var(--tone-fg|bg|ring|glow)` (light/dark handled by `.tone-*` in index.css).
- Components (`components/ui/tone.tsx`): `StatCard` (every metric tile; four tiles = four different tones), `IconTile`, `TonePill` (statuses), `FilterChips` (filters with counts + sliding highlight), `PageHeader` (every page title). `EmptyState` takes a `tone`.
- Recruiter pages that list job-related data show `JobFilter` (`hyrr.recruiter/src/components/jobs/job-filter.tsx`): bound to the store's `selectedJobId`, synced to `?job=`, shared across Board, List, Dashboard, Calendar, Messages and Analytics.
- Call hooks (e.g. `useApplicantCounts`) before any early return; `npm run lint:hooks` enforces it.

## Shell and patterns (all three apps look the same)
- Header: `APP_HEADER_CLASS` (64 px frosted bar, full width above the sidebar) with `<BrandMark app="Recruiter|Careers|Admin" />`; sidebar 260 px with the sliding `ActiveIndicator`.
- Details open as a side panel: `<DialogContent variant="sheet">` (or `SideSheet` with `SheetSection`/`KeyValues` for read-heavy panels). Centered dialogs are for short forms and confirmations.
- Lists/tables/metrics/charts from hyrr.shared: `DataTable`, `RowButton`, `SearchBox`, `Avatar`, `StatusDot`, `Delta`, `Sparkline`, `LoadingRows`, `ErrorBlock`, `LoadMore`, `ChartCard`/`TrendChart`/`BarsChart`/`RankedBars` (+ `downloadCsv`), formatting helpers in `lib/format`.
- Destructive or monetary actions: `ConfirmDialog`/`ActionConfirm`; when a reason is required, `ReasonDialog` (zod `reasonSchema`).
- Page titles: `PageHeader` only (no gradient-text titles).
