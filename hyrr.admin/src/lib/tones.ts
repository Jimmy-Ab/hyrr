import type { Tone } from "hyrr.shared"

export const companyStatusTone = (s?: string | null): Tone =>
  s === "VERIFIED" ? "emerald" : s === "SUSPENDED" ? "rose" : "amber"

export const userStatusTone = (s?: string | null): Tone =>
  s === "ACTIVE" ? "emerald" : s === "SUSPENDED" ? "rose" : "amber"

export const roleTone = (r?: string | null): Tone =>
  r === "ADMIN" ? "violet" : r === "RECRUITER" ? "blue" : "teal"

export const paymentStatusTone = (s?: string | null): Tone =>
  s === "SUCCEEDED" ? "emerald" : s === "FAILED" ? "rose" : s === "REFUNDED" ? "slate" : "amber"

export const severityTone = (s?: string | null): Tone =>
  s === "critical" ? "rose" : s === "warning" ? "amber" : "sky"
