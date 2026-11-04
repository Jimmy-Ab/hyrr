import { useJobStore } from "../store/useJobStore"
import { API_URL } from "./config"

export { API_URL }

interface RequestOptions extends RequestInit {
  skipAuth?: boolean
}

/** Error thrown for every non-2xx API response. `err.message` is always human readable. */
export class ApiError extends Error {
  readonly status: number
  readonly errorCode: string
  readonly details: unknown
  readonly timestamp: string

  constructor(init: {
    status: number
    errorCode?: string
    message: string
    details?: unknown
    timestamp?: string
  }) {
    super(init.message)
    this.name = "ApiError"
    this.status = init.status
    this.errorCode = init.errorCode || "HTTP_ERROR"
    this.details = init.details ?? null
    this.timestamp = init.timestamp || new Date().toISOString()
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}

/** Best-effort readable message for any thrown value. */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === "string" && err) return err
  return fallback
}

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string | null) => void
  reject: (err: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

async function doFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch {
    throw new ApiError({
      status: 0,
      errorCode: "NETWORK_ERROR",
      message: "Could not reach the server. Check your connection and try again.",
    })
  }
}

export async function apiFetch(path: string, options: RequestOptions = {}): Promise<any> {
  const url = `${API_URL}${path}`
  const { skipAuth, ...rest } = options
  const headers = new Headers(rest.headers || {})

  if (!headers.has("Content-Type") && !(rest.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  // Inject Bearer access token
  if (!skipAuth) {
    const token = useJobStore.getState().accessToken
    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }
  }

  const finalOptions: RequestInit = {
    ...rest,
    headers,
    credentials: "include",
  }

  const response = await doFetch(url, finalOptions)

  if (response.status === 401 && !skipAuth) {
    // Access token expired, attempt silent token refresh (single flight)
    if (isRefreshing) {
      const token = await new Promise<string | null>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
      if (!token) {
        throw new ApiError({ status: 401, errorCode: "UNAUTHORIZED", message: "Unauthorized" })
      }
      headers.set("Authorization", `Bearer ${token}`)
      return doFetch(url, finalOptions).then(handleResponse)
    }

    isRefreshing = true
    let newToken: string
    try {
      const refreshResponse = await doFetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      })
      if (!refreshResponse.ok) {
        throw new ApiError({
          status: 401,
          errorCode: "SESSION_EXPIRED",
          message: "Your session has expired. Please sign in again.",
        })
      }
      const data = await refreshResponse.json()
      newToken = data.accessToken
      // Silent refresh: only swaps the token, never reloads workspace data.
      useJobStore.getState().setAccessToken(newToken)
      processQueue(null, newToken)
    } catch (err) {
      processQueue(err, null)
      useJobStore.getState().logout()
      throw err
    } finally {
      isRefreshing = false
    }

    headers.set("Authorization", `Bearer ${newToken}`)
    return doFetch(url, finalOptions).then(handleResponse)
  }

  return handleResponse(response)
}

async function handleResponse(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type")
  let data: any = null
  if (contentType && contentType.includes("application/json")) {
    data = await response.json().catch(() => null)
  } else {
    data = await response.text().catch(() => "")
  }

  if (!response.ok) {
    let message: string =
      (Array.isArray(data?.message) ? data.message.join(", ") : data?.message) ||
      (typeof data === "string" && data ? data : response.statusText) ||
      "Request failed"
    if (response.status === 403 && !data?.message) {
      message = "You do not have permission to perform this action."
    }
    throw new ApiError({
      status: response.status,
      errorCode: data?.errorCode || "HTTP_ERROR",
      message,
      details: data?.details ?? null,
      timestamp: data?.timestamp,
    })
  }

  return data
}
