import { expect, type Page } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { createHash } from "node:crypto"
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
  const res = await api("POST", "/auth/register", {
    name,
    email,
    password: PASSWORD,
    role,
    ...(role === "RECRUITER" ? { companyName: `${name} Studio` } : {}),
  })
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

export async function setUserStatus(email: string, status: "ACTIVE" | "SUSPENDED") {
  await prisma.user.update({ where: { email }, data: { status } })
}

/** Invite links are e-mailed (hash stored); tests swap in a known raw token instead. */
export async function setInviteToken(email: string, raw: string) {
  const invite = await prisma.companyInvite.findFirstOrThrow({
    where: { email: email.toLowerCase(), acceptedAt: null, revokedAt: null },
    orderBy: { createdAt: "desc" },
  })
  await prisma.companyInvite.update({
    where: { id: invite.id },
    data: { tokenHash: createHash("sha256").update(raw).digest("hex") },
  })
}

export async function userWithCompany(email: string) {
  return prisma.user.findUniqueOrThrow({
    where: { email },
    include: { company: true, companyMemberships: true },
  })
}

/** Simulates a recruiter without a company (OAuth sign-up or someone who left a team). */
export async function detachFromCompany(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } })
  await prisma.companyMember.deleteMany({ where: { userId: user.id } })
  await prisma.user.update({ where: { id: user.id }, data: { companyId: null } })
}

export async function setSeekerProfile(
  email: string,
  data: { title: string; skills: string[]; location?: string }
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } })
  await prisma.seekerProfile.update({
    where: { userId: user.id },
    data: { title: data.title, skills: data.skills, location: data.location ?? "Nairobi" },
  })
}

export async function companyBalance(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } })
  const wallet = await prisma.creditWallet.findUniqueOrThrow({
    where: { companyId: user.companyId! },
  })
  return wallet.balance
}

export async function createWebJob(title: string, url: string) {
  return prisma.externalJob.create({
    data: {
      source: "REMOTIVE",
      sourceId: `e2e-${Date.now()}-${Math.random()}`,
      title,
      company: "Globex",
      location: "Remote",
      remote: true,
      description: "Build delightful things for a global team.",
      url,
      postedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    },
  })
}

export async function trackedJobs(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } })
  return prisma.externalApplication.findMany({ where: { userId: user.id } })
}
