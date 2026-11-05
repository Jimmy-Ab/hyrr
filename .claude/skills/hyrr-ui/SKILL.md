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
