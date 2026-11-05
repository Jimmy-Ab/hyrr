import { expect, type Page } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { API_PORT, RECRUITER_PORT, SEEKER_PORT } from "../playwright.config"

export const API = `http://localhost:${API_PORT}/api`
export const RECRUITER_URL = `http://localhost:${RECRUITER_PORT}`
export const SEEKER_URL = `http://localhost:${SEEKER_PORT}`
export const PASSWORD = "Password123!"

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.E2E_DATABASE_URL || "postgresql://u@localhost:5499/smoke?schema=public",
    },
  },
})

export const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`

export async function api<T = any>(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: any = text
  try {
    data = JSON.parse(text)
  } catch {}
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`)
  return data as T
}

/** Registers through the API and marks the e-mail verified (no inbox in tests). */
export async function createUser(role: "RECRUITER" | "SEEKER", name: string) {
  const email = `${name.toLowerCase()}${uid()}@e2e.test`
  const res = await api("POST", "/auth/register", { name, email, password: PASSWORD, role })
  await prisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } })
  if (role === "RECRUITER") {
    // Enough credits for any number of publishes in one run.
    const user = await prisma.user.findUniqueOrThrow({ where: { email } })
    await prisma.creditWallet.update({
      where: { companyId: user.companyId! },
      data: { balance: 500 },
    })
  }
  return { email, name, token: res.accessToken as string }
}

export async function verifyEmail(email: string) {
  await prisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } })
}

export async function seekerBalance(email: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    include: { creditWallet: true },
  })
  return user.creditWallet?.balance ?? 0
}

export async function firstCategoryId() {
  const cats = await api<{ id: string }[]>("GET", "/jobs/categories")
  return cats[0].id
}

export async function login(page: Page, baseUrl: string, email: string) {
  await page.goto(baseUrl)
  await page.locator("#auth-email").fill(email)
  await page.locator("#auth-password").fill(PASSWORD)
  await page.locator("#auth-submit").click()
  await expect(page.locator("#auth-submit")).toBeHidden({ timeout: 20_000 })
}

export async function disconnect() {
  await prisma.$disconnect()
}
