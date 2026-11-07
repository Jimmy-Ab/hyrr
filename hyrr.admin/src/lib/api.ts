import {
  MutationCache,
  QueryCache,
  QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { apiFetch, isApiError } from "hyrr.shared"
import { create } from "zustand"
import type { Page } from "./types"

/** Set when any admin call answers 403 TWO_FACTOR_REQUIRED; App shows the setup screen. */
export const useGate = create<{ twoFactorRequired: boolean; set: (v: boolean) => void }>((set) => ({
  twoFactorRequired: false,
  set: (v) => set({ twoFactorRequired: v }),
}))

const onApiError = (err: unknown) => {
  if (isApiError(err) && err.status === 403 && err.errorCode === "TWO_FACTOR_REQUIRED") {
    useGate.getState().set(true)
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Client errors (403, 404, 400) won't fix themselves; retry only network/5xx once.
      retry: (count, err) =>
        count < 1 && !(isApiError(err) && err.status >= 400 && err.status < 500),
    },
  },
})

type Params = Record<string, string | number | boolean | null | undefined>

/** "?a=1&b=x" from the defined, non-empty params ("" when none). */
export function qs(params: Params = {}): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export const api = {
  get: <T>(path: string, params?: Params): Promise<T> => apiFetch(`/admin${path}${qs(params)}`),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    apiFetch(`/admin${path}`, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body: unknown): Promise<T> =>
    apiFetch(`/admin${path}`, { method: "PUT", body: JSON.stringify(body) }),
}

/** GET /admin<path> with react-query caching. Pass `enabled: false` to defer. */
export function useAdminQuery<T>(path: string, params?: Params, options?: { enabled?: boolean }) {
  return useQuery<T>({
    queryKey: ["admin", path, params ?? {}],
    queryFn: () => api.get<T>(path, params),
    enabled: options?.enabled ?? true,
    placeholderData: (prev) => prev,
  })
}

/** Cursor-paginated list ({ items, nextCursor }). */
export function useCursorList<T>(path: string, params: Params = {}, limit = 25) {
  const q = useInfiniteQuery({
    queryKey: ["admin", path, params, "list"],
    queryFn: ({ pageParam }) =>
      api.get<Page<T>>(path, { ...params, limit, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: (prev) => prev,
  })
  const items = q.data?.pages.flatMap((p) => p.items) ?? []
  return { ...q, items }
}

/**
 * A mutation that refreshes every admin query afterwards (lists, detail sheets, dashboard).
 * The caller awaits `run` and toasts; errors are re-thrown.
 */
export function useAdminAction<TVars, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>) {
  const client = useQueryClient()
  const m = useMutation({
    mutationFn: fn,
    onSettled: () => client.invalidateQueries({ queryKey: ["admin"] }),
  })
  return { run: m.mutateAsync, busy: m.isPending }
}

/** Downloads a text response (e.g. /admin/audit.csv) through the authenticated client. */
export async function downloadFromApi(path: string, filename: string) {
  const text = await apiFetch(`/admin${path}`, { headers: { Accept: "text/csv" } })
  const body = typeof text === "string" ? text : JSON.stringify(text)
  saveText(body, filename, "text/csv;charset=utf-8")
}

export function saveText(text: string, filename: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
