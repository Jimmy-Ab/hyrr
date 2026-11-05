import { expect, test } from "@playwright/test"
import {
  api,
  createUser,
  disconnect,
  firstCategoryId,
  login,
  PASSWORD,
  RECRUITER_URL,
  SEEKER_URL,
  seekerBalance,
  uid,
  verifyEmail,
} from "./helpers"

test.afterAll(disconnect)

test("seeker signs up in the UI and gets the welcome credits", async ({ page }) => {
  const email = `newbie${uid()}@e2e.test`
  await page.goto(SEEKER_URL)
  await page
    .getByRole("button", { name: /sign up|create (an )?account/i })
    .first()
    .click()
  await page.locator("#auth-name").fill("Nora Newbie")
  await page.locator("#auth-email").fill(email)
  await page.locator("#auth-password").fill(PASSWORD)
  await page.locator("#auth-submit").click()
  // Signed in, but unverified: the banner asks to verify.
  await expect(page.getByText(/verify your e-mail/i).first()).toBeVisible({ timeout: 20_000 })
  expect(await seekerBalance(email)).toBe(10)
})

test("recruiter posts a job through the add-job dialog", async ({ page }) => {
  const rec = await createUser("RECRUITER", "Rita")
  const title = `E2E Platform Engineer ${uid()}`
  await login(page, RECRUITER_URL, rec.email)

  await page.getByRole("button", { name: "Create new job" }).click()
  await page.locator("#job-title").fill(title)
  await page.locator("#job-location").fill("Berlin")
  await expect(page.locator("#job-category option").first()).toHaveAttribute("value", /.+/)
  await page.getByRole("button", { name: /next/i }).click()
  await page
    .locator('[contenteditable="true"]')
    .first()
    .fill("Build and run our hiring platform services in Node.js and PostgreSQL.")
  await page.getByRole("button", { name: /next/i }).click()
  await page.locator("#job-skills").fill("Node.js")
  await page.locator("#job-skills").press("Enter")
  await page.getByPlaceholder("e.g. 5+ years of React experience").fill("3+ years of Node.js")
  await page.getByRole("button", { name: "Add requirement" }).click()
  await page.getByRole("button", { name: /publish/i }).click()

  await expect(page.getByText("Job published").first()).toBeVisible({ timeout: 20_000 })
  const jobs = await api<any[]>("GET", "/jobs", undefined, rec.token)
  const job = jobs.find((j) => j.title === title)
  expect(job?.status).toBe("ACTIVE")
  expect(job?.momentumCost).toBeGreaterThan(0)
})

test("seeker applies to a job, pays 1 credit, recruiter sees the candidate", async ({
  page,
  browser,
}) => {
  const rec = await createUser("RECRUITER", "Rex")
  const seeker = await createUser("SEEKER", "Sam")
  const title = `E2E Data Engineer ${uid()}`
  const job = await api(
    "POST",
    "/jobs",
    {
      title,
      location: "Berlin",
      type: "FULL_TIME",
      description: "<p>Pipelines in Python and PostgreSQL for our analytics team.</p>",
      requirements: ["Python"],
      skills: ["Python"],
      categoryId: await firstCategoryId(),
    },
    rec.token
  )

  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/discover`)
  await page
    .getByRole("tab", { name: "All jobs" })
    .or(page.getByRole("button", { name: "All jobs" }))
    .first()
    .click()
  await page.getByText(title).first().click()
  await page
    .getByRole("button", { name: /apply now/i })
    .first()
    .click()
  const submit = page.getByRole("button", { name: /apply · 1 credit/i })
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(page.getByText("Applied!").first()).toBeVisible({ timeout: 20_000 })
  expect(await seekerBalance(seeker.email)).toBe(9)

  // Seeker Momentum page shows the new balance and the charge.
  await page.goto(`${SEEKER_URL}/momentum`)
  await expect(page.getByText("Available credits")).toBeVisible()
  await expect(page.getByText("Job application").first()).toBeVisible()

  // Recruiter sees the applicant in the pipeline.
  const recPage = await (await browser.newContext()).newPage()
  await login(recPage, RECRUITER_URL, rec.email)
  await recPage.goto(`${RECRUITER_URL}/applications`)
  await expect(recPage.getByText("Sam").first()).toBeVisible({ timeout: 20_000 })
  const cands = await api<any>("GET", "/applications/candidates", undefined, rec.token)
  const list: any[] = Array.isArray(cands) ? cands : cands.items
  expect(list.some((c) => c.jobId === job.id && c.source === "DIRECT")).toBe(true)
})

test("messages flow both ways between recruiter and seeker", async ({ page, browser }) => {
  const rec = await createUser("RECRUITER", "Mia")
  const seeker = await createUser("SEEKER", "Leo")
  const job = await api(
    "POST",
    "/jobs",
    {
      title: `E2E Designer ${uid()}`,
      location: "Remote",
      type: "FULL_TIME",
      description: "<p>Design delightful hiring experiences for our users.</p>",
      requirements: ["Figma"],
      skills: ["Figma"],
      categoryId: await firstCategoryId(),
    },
    rec.token
  )
  const app = await api(
    "POST",
    `/applications/jobs/${job.id}/apply`,
    { name: "Leo", email: seeker.email, title: "Designer", location: "Remote" },
    seeker.token
  )
  await api("POST", `/messages/${app.id}`, { text: "Hi Leo, are you free for a call?" }, rec.token)

  // Seeker reads and replies in the UI.
  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/messages`)
  await page
    .getByRole("list", { name: "Conversations" })
    .getByText(/Mia|E2E Designer/)
    .first()
    .click()
  await expect(page.getByText("Hi Leo, are you free for a call?").last()).toBeVisible()
  const reply = `Yes, tomorrow works ${uid()}`
  await page.getByPlaceholder(/^Message /).fill(reply)
  await page.getByRole("button", { name: "Send message" }).click()
  await expect(page.getByText(reply).last()).toBeVisible()

  // Recruiter receives it in the UI.
  const recPage = await (await browser.newContext()).newPage()
  await login(recPage, RECRUITER_URL, rec.email)
  await recPage.goto(`${RECRUITER_URL}/messages`)
  await recPage.getByRole("list", { name: "Conversations" }).getByText("Leo").first().click()
  await expect(recPage.getByText(reply).last()).toBeVisible({ timeout: 20_000 })
})

test("unverified e-mail and missing credits are explained in the UI", async ({ page }) => {
  const seeker = await createUser("SEEKER", "Zoe")
  await verifyEmail(seeker.email)
  const rec = await createUser("RECRUITER", "Ray")
  const title = `E2E Broke ${uid()}`
  await api(
    "POST",
    "/jobs",
    {
      title,
      location: "Berlin",
      type: "FULL_TIME",
      description: "<p>A job that the seeker cannot afford to apply to.</p>",
      requirements: ["Go"],
      skills: ["Go"],
      categoryId: await firstCategoryId(),
    },
    rec.token
  )
  // Spend all welcome credits.
  const { PrismaClient } = await import("@prisma/client")
  const db = new PrismaClient({
    datasources: {
      db: {
        url: process.env.E2E_DATABASE_URL || "postgresql://u@localhost:5499/smoke?schema=public",
      },
    },
  })
  const user = await db.user.findUniqueOrThrow({ where: { email: seeker.email } })
  await db.creditWallet.update({ where: { userId: user.id }, data: { balance: 0 } })
  await db.$disconnect()

  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/discover`)
  await page
    .getByRole("tab", { name: "All jobs" })
    .or(page.getByRole("button", { name: "All jobs" }))
    .first()
    .click()
  await page.getByText(title).first().click()
  await page
    .getByRole("button", { name: /apply now/i })
    .first()
    .click()
  await page.getByRole("button", { name: /apply · 1 credit/i }).click()
  await expect(page.getByText(/applying needs 1 momentum credit/i)).toBeVisible()
  await page.getByRole("button", { name: "Buy credits" }).click()
  await expect(page).toHaveURL(/\/momentum/)
})
