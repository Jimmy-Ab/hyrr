import { create } from "zustand"

export type AdminView =
  "dashboard" | "analytics" | "moderation" | "users" | "companies" | "money" | "settings" | "audit"

export const VIEWS: AdminView[] = [
  "dashboard",
  "analytics",
  "moderation",
  "users",
  "companies",
  "money",
  "settings",
  "audit",
]

export const pathToView = (path: string): AdminView | null => {
  const seg = path.replace(/^\/+|\/+$/g, "").split("/")[0]
  return (VIEWS as string[]).includes(seg) ? (seg as AdminView) : null
}
export const viewToPath = (view: AdminView) => `/${view}`

type Nav = {
  view: AdminView
  /** A record to open in the target view's side sheet (cross-links between screens). */
  focus: { view: AdminView; id: string } | null
  /** Optional list filter preset for the target view (e.g. moderation "open"). */
  preset: Record<string, string> | null
  go: (view: AdminView, opts?: { focusId?: string; preset?: Record<string, string> }) => void
  clearFocus: () => void
}

export const useNav = create<Nav>((set) => ({
  view: pathToView(window.location.pathname) ?? "dashboard",
  focus: null,
  preset: null,
  go: (view, opts) =>
    set({
      view,
      focus: opts?.focusId ? { view, id: opts.focusId } : null,
      preset: opts?.preset ?? null,
    }),
  clearFocus: () => set({ focus: null }),
}))
