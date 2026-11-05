/**
 * Minimal fetch-based Meilisearch client (the official `meilisearch` package is ESM-only and
 * breaks jest). Every request has a hard timeout; errors surface as `MeiliError`.
 */

export class MeiliError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string
  ) {
    super(message)
    this.name = "MeiliError"
  }
}

export type MeiliTask = {
  taskUid: number
  status?: string
}

export type MeiliTaskStatus = {
  uid: number
  status: "enqueued" | "processing" | "succeeded" | "failed" | "canceled"
  error?: { message?: string; code?: string } | null
}

export type MeiliSearchRequest = {
  q?: string
  filter?: string | string[]
  sort?: string[]
  limit?: number
  offset?: number
  attributesToRetrieve?: string[]
}

export type MeiliSearchResponse<T> = {
  hits: T[]
  estimatedTotalHits?: number
  totalHits?: number
}

export type MeiliIndexSettings = {
  searchableAttributes?: string[]
  filterableAttributes?: string[]
  sortableAttributes?: string[]
}

type FetchLike = typeof fetch

export class MeiliClient {
  private readonly host: string

  constructor(
    host: string,
    private readonly apiKey?: string,
    private readonly timeoutMs = 2000,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init)
  ) {
    this.host = host.replace(/\/+$/, "")
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    const headers: Record<string, string> = {}
    if (body !== undefined) headers["Content-Type"] = "application/json"
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`
    let res: Response
    try {
      res = await this.fetchImpl(`${this.host}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err: any) {
      const reason = err?.name === "AbortError" ? `timed out after ${this.timeoutMs} ms` : err?.message
      throw new MeiliError(`Meilisearch ${method} ${path} failed: ${reason}`)
    } finally {
      clearTimeout(timer)
    }
    const text = await res.text().catch(() => "")
    let json: any = undefined
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = undefined
      }
    }
    if (!res.ok)
      throw new MeiliError(
        `Meilisearch ${method} ${path} → ${res.status}: ${json?.message ?? (text.slice(0, 200) || res.statusText)}`,
        res.status,
        json?.code
      )
    return json as T
  }

  async health(): Promise<boolean> {
    const res = await this.request<{ status?: string }>("GET", "/health")
    return res?.status === "available"
  }

  getTask(taskUid: number): Promise<MeiliTaskStatus> {
    return this.request<MeiliTaskStatus>("GET", `/tasks/${taskUid}`)
  }

  /** Polls a task until it settles; throws when it failed or did not finish within `timeoutMs`. */
  async waitForTask(taskUid: number, timeoutMs = 30_000, intervalMs = 100): Promise<MeiliTaskStatus> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const task = await this.getTask(taskUid)
      if (task.status === "succeeded") return task
      if (task.status === "failed" || task.status === "canceled")
        throw new MeiliError(
          `Meilisearch task ${taskUid} ${task.status}: ${task.error?.message ?? "unknown error"}`,
          undefined,
          task.error?.code
        )
      if (Date.now() >= deadline)
        throw new MeiliError(`Meilisearch task ${taskUid} still ${task.status} after ${timeoutMs} ms`)
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  createIndex(uid: string, primaryKey: string): Promise<MeiliTask> {
    return this.request<MeiliTask>("POST", "/indexes", { uid, primaryKey })
  }

  updateSettings(uid: string, settings: MeiliIndexSettings): Promise<MeiliTask> {
    return this.request<MeiliTask>("PATCH", `/indexes/${encodeURIComponent(uid)}/settings`, settings)
  }

  /** Add-or-replace (POST) so stale fields never survive an update. */
  addDocuments(uid: string, documents: unknown[], primaryKey = "id"): Promise<MeiliTask> {
    return this.request<MeiliTask>(
      "POST",
      `/indexes/${encodeURIComponent(uid)}/documents?primaryKey=${encodeURIComponent(primaryKey)}`,
      documents
    )
  }

  deleteDocument(uid: string, id: string): Promise<MeiliTask> {
    return this.request<MeiliTask>(
      "DELETE",
      `/indexes/${encodeURIComponent(uid)}/documents/${encodeURIComponent(id)}`
    )
  }

  search<T = { id: string }>(uid: string, body: MeiliSearchRequest): Promise<MeiliSearchResponse<T>> {
    return this.request<MeiliSearchResponse<T>>(
      "POST",
      `/indexes/${encodeURIComponent(uid)}/search`,
      body
    )
  }

  /** Document count, or null when the index does not exist yet. */
  async documentCount(uid: string): Promise<number | null> {
    try {
      const stats = await this.request<{ numberOfDocuments?: number }>(
        "GET",
        `/indexes/${encodeURIComponent(uid)}/stats`
      )
      return stats?.numberOfDocuments ?? 0
    } catch (err: any) {
      if (err instanceof MeiliError && (err.status === 404 || err.code === "index_not_found"))
        return null
      throw err
    }
  }
}

/** Meilisearch filter string literal: `"value"` with quotes and backslashes escaped. */
export function meiliQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}
