import { expect, test } from "@playwright/test"
import {
  API,
  api,
  companyBalance,
  createActiveJobs,
  createUser,
  createWebJob,
  detachFromCompany,
  disconnect,
  firstCategoryId,
  login,
  PASSWORD,
  RECRUITER_URL,
  seedSkillQuestions,
  SEEKER_URL,
  seekerBalance,
  setInviteToken,
  setSeekerProfile,
  setUserStatus,
  trackedJobs,
  uid,
  userWithCompany,
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

test("recruiter opens a candidate from the list view (no crash)", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  const rec = await createUser("RECRUITER", "Bea")
  const seeker = await createUser("SEEKER", "Kalkidan")
  const job = await api(
    "POST",
    "/jobs",
    {
      title: `E2E List View ${uid()}`,
      location: "Berlin",
      type: "FULL_TIME",
      description: "<p>Open the candidate from the list view.</p>",
      requirements: ["X"],
      skills: ["X"],
      categoryId: await firstCategoryId(),
    },
    rec.token
  )
  await api(
    "POST",
    `/applications/jobs/${job.id}/apply`,
    { name: "Kalkidan", email: seeker.email, title: "Dev", location: "Berlin" },
    seeker.token
  )
  await login(page, RECRUITER_URL, rec.email)
  await page.goto(`${RECRUITER_URL}/applications`)
  await page
    .getByRole("button", { name: /^list$/i })
    .first()
    .click()
  await page.getByText("Kalkidan", { exact: true }).first().click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByRole("dialog").getByText("Kalkidan").first()).toBeVisible()
  expect(errors).toEqual([])
})

test("candidates list filters by job (kept across reload and board/list)", async ({ page }) => {
  const rec = await createUser("RECRUITER", "Fia")
  const cat = await firstCategoryId()
  const mkJob = (title: string) =>
    api(
      "POST",
      "/jobs",
      {
        title,
        location: "Berlin",
        type: "FULL_TIME",
        description: "<p>A job used to check the job filter.</p>",
        requirements: ["X"],
        skills: ["X"],
        categoryId: cat,
      },
      rec.token
    )
  const jobA = await mkJob(`Filter Alpha ${uid()}`)
  const jobB = await mkJob(`Filter Beta ${uid()}`)
  for (const [name, job] of [
    ["Abebe", jobA],
    ["Bethel", jobB],
  ] as const) {
    const s = await createUser("SEEKER", name)
    await api(
      "POST",
      `/applications/jobs/${job.id}/apply`,
      { name, email: s.email, title: "Dev", location: "Berlin" },
      s.token
    )
  }
  await login(page, RECRUITER_URL, rec.email)
  await page.goto(`${RECRUITER_URL}/candidates`)
  const jobs = page.getByRole("group", { name: "Filter by job" })
  await jobs.getByRole("button", { name: new RegExp(jobA.title) }).click()
  await expect(page.getByText("Abebe", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Bethel", { exact: true })).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`job=${jobA.id}`))

  await page.reload()
  await expect(page.getByText("Abebe", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Bethel", { exact: true })).toHaveCount(0)

  await page
    .getByRole("group", { name: "Pipeline view" })
    .getByRole("button", { name: "Board" })
    .click()
  await expect(
    page
      .getByRole("group", { name: "Filter by job" })
      .getByRole("button", { name: new RegExp(jobA.title) })
  ).toHaveAttribute("aria-pressed", "true")
})

test("seeker dashboard stat cards use four different colours", async ({ page }) => {
  const s = await createUser("SEEKER", "Hana")
  await login(page, SEEKER_URL, s.email)
  await page.goto(`${SEEKER_URL}/dashboard`)
  const cards = page.locator(".tone-card")
  await expect(cards.first()).toBeVisible()
  const colours = await cards.evaluateAll((els) =>
    els.slice(0, 4).map((el) => getComputedStyle(el.querySelector("svg")!).color)
  )
  expect(new Set(colours).size).toBe(4)
})

test("a suspended seeker gets a clear message at sign-in", async ({ page }) => {
  const s = await createUser("SEEKER", "Selam")
  await setUserStatus(s.email, "SUSPENDED")
  await page.goto(SEEKER_URL)
  await page.locator("#auth-email").fill(s.email)
  await page.locator("#auth-password").fill(PASSWORD)
  await page.locator("#auth-submit").click()
  await expect(page.getByRole("alert").filter({ hasText: /suspended/i })).toBeVisible()
  await expect(page.getByRole("alert").filter({ hasText: /contact/i })).toBeVisible()
})

test("seeker and recruiter apps share the same shell", async ({ browser }) => {
  const sizes: { header: number; sidebar: number; badge: string }[] = []
  for (const [url, role] of [
    [SEEKER_URL, "SEEKER"],
    [RECRUITER_URL, "RECRUITER"],
  ] as const) {
    const page = await (
      await browser.newContext({ viewport: { width: 1400, height: 900 } })
    ).newPage()
    const u = await createUser(role, role === "SEEKER" ? "Tigist" : "Yonas")
    await login(page, url, u.email)
    const header = page.locator("header.glass").first()
    await expect(header).toBeVisible()
    const box = await header.boundingBox()
    const nav = await page.locator("aside").first().boundingBox()
    sizes.push({
      header: Math.round(box!.height),
      sidebar: Math.round(nav!.width),
      badge: (await header.textContent()) ?? "",
    })
  }
  expect(sizes[0].header).toBe(64)
  expect(sizes[1].header).toBe(64)
  expect(sizes[0].sidebar).toBe(sizes[1].sidebar)
  expect(sizes[0].badge).toContain("HYRR")
  expect(sizes[1].badge).toContain("HYRR")
})

test("recruiter signs up with their company name and website", async ({ page }) => {
  const email = `founder${uid()}@e2e.test`
  const company = `Orbit Labs ${uid()}`
  await page.goto(RECRUITER_URL)
  await page
    .getByRole("button", { name: /sign up|create (an )?account/i })
    .first()
    .click()
  await page.locator("#auth-name").fill("Fiona Founder")
  await page.locator("#auth-email").fill(email)
  await page.locator("#auth-password").fill(PASSWORD)
  // The company name is required for a new company.
  await page.locator("#auth-submit").click()
  await expect(page.getByText("Enter your company name")).toBeVisible()
  await page.locator("#auth-company").fill(company)
  await page.locator("#auth-website").fill("orbit-labs.io")
  await page.locator("#auth-submit").click()
  await expect(page.getByRole("button", { name: "Create new job" })).toBeVisible({
    timeout: 20_000,
  })
  const user = await userWithCompany(email)
  expect(user.company?.name).toBe(company)
  expect(user.company?.website).toBe("https://orbit-labs.io")
  expect(user.company?.country).toBe("")
  expect(user.companyMemberships[0]?.role).toBe("OWNER")
})

test("an invited colleague signs up through the link and sees the company's jobs", async ({
  page,
}) => {
  const owner = await createUser("RECRUITER", "Olga")
  const title = `E2E Team Job ${uid()}`
  await api(
    "POST",
    "/jobs",
    {
      title,
      location: "Berlin",
      type: "FULL_TIME",
      description: "<p>Work with the team on our hiring platform and services.</p>",
      requirements: ["TypeScript"],
      skills: ["TypeScript"],
      categoryId: await firstCategoryId(),
    },
    owner.token
  )
  const inviteeEmail = `tom${uid()}@e2e.test`
  await api("POST", "/talent/team/invites", { email: inviteeEmail, role: "RECRUITER" }, owner.token)
  const token = `e2e-${uid()}`
  await setInviteToken(inviteeEmail, token)

  await page.goto(`${RECRUITER_URL}/invite?token=${token}`)
  await expect(page.getByText(/invited you to join/i)).toBeVisible({ timeout: 20_000 })
  // Joining: no company fields.
  await expect(page.locator("#auth-company")).toHaveCount(0)
  await page.locator("#auth-name").fill("Tom Teammate")
  await page.locator("#auth-email").fill(inviteeEmail)
  await page.locator("#auth-password").fill(PASSWORD)
  await page.locator("#auth-submit").click()
  await expect(page.getByRole("button", { name: "Create new job" })).toBeVisible({
    timeout: 20_000,
  })

  const ownerUser = await userWithCompany(owner.email)
  const invitee = await userWithCompany(inviteeEmail)
  expect(invitee.companyId).toBe(ownerUser.companyId)
  expect(invitee.companyMemberships.map((m) => m.role)).toEqual(["RECRUITER"])
  // The link proves the inbox.
  expect(invitee.emailVerifiedAt).not.toBeNull()

  await page.goto(`${RECRUITER_URL}/jobs`)
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 })
})

test("a recruiter without a company sets one up first", async ({ page }) => {
  const rec = await createUser("RECRUITER", "Nia")
  await detachFromCompany(rec.email)
  await login(page, RECRUITER_URL, rec.email)
  await expect(page.getByRole("heading", { name: "Set up your company" })).toBeVisible({
    timeout: 20_000,
  })
  const company = `Nia Works ${uid()}`
  await page.locator("#setup-company").fill(company)
  await page.getByRole("button", { name: "Create company" }).click()
  await expect(page.getByRole("button", { name: "Create new job" })).toBeVisible({
    timeout: 20_000,
  })
  expect((await userWithCompany(rec.email)).company?.name).toBe(company)
})

test("dragging a kanban card follows the pointer and drops in the column under it", async ({
  page,
}) => {
  const rec = await createUser("RECRUITER", "Kai")
  const seeker = await createUser("SEEKER", "Dora")
  const job = await api(
    "POST",
    "/jobs",
    {
      title: `E2E Drag Job ${uid()}`,
      location: "Berlin",
      type: "FULL_TIME",
      description: "<p>Moving candidates across the pipeline board by drag and drop.</p>",
      requirements: ["Go"],
      skills: ["Go"],
      categoryId: await firstCategoryId(),
    },
    rec.token
  )
  await api(
    "POST",
    `/applications/jobs/${job.id}/apply`,
    { name: "Dora", email: seeker.email, title: "Dev", location: "Berlin" },
    seeker.token
  )

  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, RECRUITER_URL, rec.email)
  await page.goto(`${RECRUITER_URL}/applications`)
  const card = page.locator('[aria-roledescription="draggable"]').filter({ hasText: "Dora" })
  await expect(card).toBeVisible({ timeout: 20_000 })
  const target = page.getByRole("heading", { name: "In Process", level: 2 })

  const from = (await card.boundingBox())!
  const to = (await target.boundingBox())!
  // The name is a button (opens the candidate); grab the card body.
  const start = { x: from.x + from.width / 2, y: from.y + from.height * 0.55 }
  const end = { x: to.x + to.width / 2, y: to.y + 160 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 20, start.y, { steps: 4 })
  await page.mouse.move(end.x, end.y, { steps: 15 })

  // Only one solid card while dragging, and it is under the pointer.
  const copies = page.getByText("Dora", { exact: true })
  await expect(copies).toHaveCount(2) // faded placeholder + the card under the pointer
  const dragged = (await copies.last().boundingBox())!
  const placeholder = (await copies.first().boundingBox())!
  // The overlay card keeps the grab offset: its name sits where it was relative to the pointer.
  const expectedX = placeholder.x + (end.x - start.x)
  const expectedY = placeholder.y + (end.y - start.y)
  expect(Math.abs(dragged.x - expectedX)).toBeLessThan(24)
  expect(Math.abs(dragged.y - expectedY)).toBeLessThan(24)
  expect(Math.abs(placeholder.x - (from.x + 0)) < from.width).toBe(true) // placeholder stays put

  await page.mouse.up()
  await expect(page.getByText("Status updated").first()).toBeVisible({ timeout: 10_000 })
  const cands = await api<any>("GET", "/applications/candidates", undefined, rec.token)
  const list: any[] = Array.isArray(cands) ? cands : cands.items
  expect(list.find((c) => c.jobId === job.id)?.status).toBe("IN_PROCESS")
})

test("discover's empty 'for you' state is centred", async ({ page }) => {
  const seeker = await createUser("SEEKER", "Ema")
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/discover`)
  const empty = page
    .getByRole("heading", { name: /no matches right now|tell us what you do/i })
    .locator("xpath=..")
  await expect(empty).toBeVisible({ timeout: 20_000 })
  const card = (await empty.boundingBox())!
  const main = (await page.locator("main").boundingBox())!
  const cardCenter = card.x + card.width / 2
  const mainCenter = main.x + main.width / 2
  expect(Math.abs(cardCenter - mainCenter)).toBeLessThan(40)
})

test("seeker calendar shows the interview with company and recruiter on the date", async ({
  page,
}) => {
  const rec = await createUser("RECRUITER", "Ruth")
  const seeker = await createUser("SEEKER", "Abel")
  const job = await api(
    "POST",
    "/jobs",
    {
      title: `E2E Calendar Job ${uid()}`,
      location: "Berlin",
      type: "FULL_TIME",
      description: "<p>Interview scheduling shows up on the seeker calendar.</p>",
      requirements: ["SQL"],
      skills: ["SQL"],
      categoryId: await firstCategoryId(),
    },
    rec.token
  )
  const app = await api(
    "POST",
    `/applications/jobs/${job.id}/apply`,
    { name: "Abel", email: seeker.email, title: "Analyst", location: "Berlin" },
    seeker.token
  )
  const start = new Date()
  start.setHours(15, 0, 0, 0)
  await api(
    "POST",
    "/calendar",
    {
      applicationId: app.id,
      title: "Technical interview",
      startTime: start.toISOString(),
      type: "INTERVIEW",
      location: "Video call",
    },
    rec.token
  )

  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/calendar`)
  // The chip on the date names the company and the recruiter, not just a dot.
  const chip = page
    .locator("button")
    .filter({ hasText: "Technical interview" })
    .filter({ hasText: "Ruth Studio" })
    .first()
  await expect(chip).toBeVisible({ timeout: 20_000 })
  await expect(chip).toContainText("Ruth")
  await chip.click()
  const sheet = page.getByRole("dialog")
  await expect(sheet.getByText("Technical interview")).toBeVisible()
  await expect(sheet.getByText("With Ruth")).toBeVisible()
  await expect(sheet.getByText(job.title)).toBeVisible()
  // A recruiter's interview can't be deleted by the seeker.
  await expect(sheet.getByRole("button", { name: /delete event/i })).toHaveCount(0)
})

test("live sync: a new applicant appears on the recruiter board and the seeker sees moves", async ({
  page,
  browser,
}) => {
  const rec = await createUser("RECRUITER", "Liv")
  const seeker = await createUser("SEEKER", "Lena")
  const job = await api(
    "POST",
    "/jobs",
    {
      title: `E2E Live Job ${uid()}`,
      location: "Berlin",
      type: "FULL_TIME",
      description: "<p>Live updates between the recruiter and seeker apps.</p>",
      requirements: ["Go"],
      skills: ["Go"],
      categoryId: await firstCategoryId(),
    },
    rec.token
  )
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, RECRUITER_URL, rec.email)
  await page.goto(`${RECRUITER_URL}/applications`)
  await expect(page.getByRole("heading", { name: "Applied", level: 2 })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByText("Lena", { exact: true })).toHaveCount(0)

  // The seeker applies while the board is open: no reload.
  const app = await api(
    "POST",
    `/applications/jobs/${job.id}/apply`,
    { name: "Lena", email: seeker.email, title: "Dev", location: "Berlin" },
    seeker.token
  )
  await expect(page.getByText("Lena", { exact: true }).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText("New applicant").first()).toBeVisible()

  // The recruiter's move shows up on the seeker's board live.
  const seekerPage = await (
    await browser.newContext({ viewport: { width: 1400, height: 900 } })
  ).newPage()
  await login(seekerPage, SEEKER_URL, seeker.email)
  await seekerPage.goto(`${SEEKER_URL}/applications`)
  await expect(seekerPage.getByText(job.title).first()).toBeVisible({ timeout: 20_000 })
  await api("PUT", `/applications/${app.id}`, { status: "INTERVIEWING" }, rec.token)
  await expect(seekerPage.getByText("Application updated").first()).toBeVisible({
    timeout: 10_000,
  })
})

test("interview slots: the seeker picks a time live and both sides see the booking", async ({
  page,
  browser,
}) => {
  const rec = await createUser("RECRUITER", "Ines")
  const seeker = await createUser("SEEKER", "Omar")
  const job = await api(
    "POST",
    "/jobs",
    {
      title: `E2E Slots Job ${uid()}`,
      location: "Berlin",
      type: "FULL_TIME",
      description: "<p>Self-serve interview scheduling between the apps.</p>",
      requirements: ["Rust"],
      skills: ["Rust"],
      categoryId: await firstCategoryId(),
    },
    rec.token
  )
  const app = await api(
    "POST",
    `/applications/jobs/${job.id}/apply`,
    { name: "Omar", email: seeker.email, title: "Dev", location: "Berlin" },
    seeker.token
  )

  // Both apps open before the invite exists.
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/applications`)
  await expect(page.getByText(job.title).first()).toBeVisible({ timeout: 20_000 })
  const recPage = await (
    await browser.newContext({ viewport: { width: 1400, height: 900 } })
  ).newPage()
  await login(recPage, RECRUITER_URL, rec.email)
  await recPage.goto(`${RECRUITER_URL}/calendar`)

  const at = (days: number, hour: number) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setHours(hour, 0, 0, 0)
    return d.toISOString()
  }
  await api(
    "POST",
    "/calendar/invites",
    {
      applicationId: app.id,
      title: "Culture chat",
      durationMin: 30,
      slots: [{ startTime: at(2, 10) }, { startTime: at(2, 15) }],
      meetingUrl: "https://meet.example.com/abc",
    },
    rec.token
  )

  // The picker opens by itself on the seeker side.
  const dialog = page.getByRole("dialog", { name: "Pick your interview time" })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await dialog.getByRole("radio").first().click()
  await dialog.getByRole("button", { name: "Book this time" }).click()
  await expect(page.getByText("Interview booked").first()).toBeVisible({ timeout: 10_000 })

  // The recruiter sees it live.
  await expect(recPage.getByText("Interview booked").first()).toBeVisible({ timeout: 10_000 })
  const events = await api<any[]>("GET", "/calendar", undefined, rec.token)
  expect(events.some((e) => e.applicationId === app.id && e.title === "Culture chat")).toBe(true)
  const cands = await api<any>("GET", "/applications/candidates", undefined, rec.token)
  const list: any[] = Array.isArray(cands) ? cands : cands.items
  expect(list.find((c) => c.id === app.id)?.status).toBe("INTERVIEWING")
})

test("scorecards are blind until you submit, then show the team debrief", async ({ page }) => {
  const owner = await createUser("RECRUITER", "Mara")
  const mate = await createUser("RECRUITER", "Nils")
  // Nils joins Mara's company through an invite.
  await api(
    "POST",
    "/talent/team/invites",
    { email: mate.email, role: "HIRING_MANAGER" },
    owner.token
  )
  const token = `sc-${uid()}`
  await setInviteToken(mate.email, token)
  await api("POST", `/team/invites/${token}/accept`, undefined, mate.token)

  const seeker = await createUser("SEEKER", "Selam")
  const job = await api(
    "POST",
    "/jobs",
    {
      title: `E2E Scorecard Job ${uid()}`,
      location: "Berlin",
      type: "FULL_TIME",
      description: "<p>Structured interview feedback with blind scorecards.</p>",
      requirements: ["SQL"],
      skills: ["SQL"],
      categoryId: await firstCategoryId(),
    },
    owner.token
  )
  const app = await api(
    "POST",
    `/applications/jobs/${job.id}/apply`,
    { name: "Selam", email: seeker.email, title: "Analyst", location: "Berlin" },
    seeker.token
  )
  const criteria = ["Technical skills", "Problem solving", "Communication", "Culture add"]
  await api(
    "PUT",
    `/scorecards/applications/${app.id}`,
    {
      recommendation: "STRONG_YES",
      overallNotes: "Owner says: excellent SQL depth and calm under pressure.",
      ratings: criteria.map((competency) => ({ competency, score: 5 })),
    },
    owner.token
  )

  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, RECRUITER_URL, mate.email)
  await page.goto(`${RECRUITER_URL}/applications`)
  await page
    .getByRole("button", { name: /^list$/i })
    .first()
    .click()
  await page.getByText("Selam", { exact: true }).first().click()
  const sheet = page.getByRole("dialog")
  await sheet.getByRole("tab", { name: "Scorecards" }).click()
  await expect(sheet.getByText(/1 colleague has submitted/)).toBeVisible({ timeout: 10_000 })
  await expect(sheet.getByText("Owner says")).toHaveCount(0)

  for (const c of criteria)
    await sheet.getByRole("radiogroup", { name: c }).getByRole("radio", { name: "4 of 5" }).click()
  await sheet.getByRole("radio", { name: "Yes", exact: true }).click()
  await sheet
    .locator("#scorecard-notes")
    .fill("Clear communicator, would like to probe system design.")
  await sheet.getByRole("button", { name: "Submit scorecard" }).click()

  await expect(sheet.getByText(/Owner says/)).toBeVisible({ timeout: 10_000 })
  await expect(sheet.getByText("Team leans hire")).toBeVisible()
  await expect(sheet.getByText(/Debrief · 2 scorecards/)).toBeVisible()
})

test("offers: the recruiter sends terms, the seeker signs live, the team celebrates", async ({
  page,
  browser,
}) => {
  const rec = await createUser("RECRUITER", "Hana")
  const seeker = await createUser("SEEKER", "Dawit")
  const job = await api(
    "POST",
    "/jobs",
    {
      title: `E2E Offer Job ${uid()}`,
      location: "Addis Ababa",
      type: "FULL_TIME",
      description: "<p>Digital offer letters with in-app acceptance.</p>",
      requirements: ["Go"],
      skills: ["Go"],
      categoryId: await firstCategoryId(),
    },
    rec.token
  )
  await api(
    "POST",
    `/applications/jobs/${job.id}/apply`,
    { name: "Dawit", email: seeker.email, title: "Engineer", location: "Addis Ababa" },
    seeker.token
  )

  const seekerPage = await (
    await browser.newContext({ viewport: { width: 1400, height: 900 } })
  ).newPage()
  await login(seekerPage, SEEKER_URL, seeker.email)
  await seekerPage.goto(`${SEEKER_URL}/applications`)
  await expect(seekerPage.getByText(job.title).first()).toBeVisible({ timeout: 20_000 })

  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, RECRUITER_URL, rec.email)
  await page.goto(`${RECRUITER_URL}/applications`)
  await page
    .getByRole("button", { name: /^list$/i })
    .first()
    .click()
  await page.getByText("Dawit", { exact: true }).first().click()
  const panel = page.getByRole("dialog")
  await panel.getByRole("tab", { name: "Offer" }).click()
  await panel.getByRole("button", { name: "Make an offer" }).click()
  await panel.locator("#offer-base").fill("85000")
  await panel.locator("#offer-currency").selectOption("ETB")
  await panel.locator("#offer-benefits").fill("Health insurance, Remote days")
  await panel.getByRole("button", { name: "Send offer" }).click()
  await expect(page.getByText("Offer sent").first()).toBeVisible({ timeout: 10_000 })
  await expect(panel.getByText("Waiting for answer")).toBeVisible()
  await panel.getByRole("button", { name: "Close Details" }).click()

  // Opens by itself for the seeker.
  const sheet = seekerPage.getByRole("dialog")
  await expect(sheet.getByText(/Offer from/)).toBeVisible({ timeout: 10_000 })
  await expect(sheet.getByText("Health insurance")).toBeVisible()
  // Free market check (no invented numbers when there are too few postings).
  await expect(sheet.getByText("Market check")).toBeVisible()
  await expect(
    sheet.getByText(/Not enough postings in ETB|postings for similar roles/)
  ).toBeVisible()
  await sheet.getByRole("button", { name: "Accept offer" }).click()
  await expect(sheet.getByText("Type your full name to sign")).toBeVisible()
  await sheet.locator("#offer-signature").fill("Dawit Bekele")
  await sheet.getByRole("checkbox").check()
  await sheet.getByRole("button", { name: "Accept offer" }).click()
  await expect(seekerPage.getByText(/Offer accepted/).first()).toBeVisible({ timeout: 10_000 })

  // Live on the recruiter side.
  await expect(page.getByText(/Dawit accepted the offer/).first()).toBeVisible({ timeout: 10_000 })
})

test("talent search: an opted-in seeker is found, contacted and says Interested", async ({
  page,
  browser,
}) => {
  const rec = await createUser("RECRUITER", "Tariku")
  const seeker = await createUser("SEEKER", "Amina")
  const skill = `Elixir${uid()}`
  await setSeekerProfile(seeker.email, { title: "Backend Engineer", skills: [skill, "PostgreSQL"] })
  const job = await api(
    "POST",
    "/jobs",
    {
      title: `E2E Outreach Job ${uid()}`,
      location: "Nairobi",
      type: "FULL_TIME",
      description: "<p>Reaching out to opted-in talent from search.</p>",
      requirements: ["Elixir"],
      skills: ["Elixir"],
      categoryId: await firstCategoryId(),
    },
    rec.token
  )

  // Seeker opts in (off by default).
  const seekerPage = await (
    await browser.newContext({ viewport: { width: 1400, height: 900 } })
  ).newPage()
  await login(seekerPage, SEEKER_URL, seeker.email)
  await seekerPage.goto(`${SEEKER_URL}/settings`)
  await seekerPage.getByRole("tab", { name: /privacy/i }).click()
  const toggle = seekerPage.getByRole("switch", { name: "Open to recruiters" })
  await expect(toggle).toHaveAttribute("aria-checked", "false")
  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-checked", "true")
  await seekerPage.goto(`${SEEKER_URL}/applications`)

  // Recruiter finds and contacts them.
  const before = await companyBalance(rec.email)
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, RECRUITER_URL, rec.email)
  await page.goto(`${RECRUITER_URL}/candidates`)
  await page.getByRole("button", { name: "Talent search" }).click()
  await page.locator("#talent-q").fill(skill)
  await page.getByRole("button", { name: "Search", exact: true }).click()
  await page.getByText("Amina", { exact: true }).first().click()
  const sheet = page.getByRole("dialog")
  await expect(sheet.getByText(/never|Contact details/i).first()).toBeVisible()
  await sheet.locator("#outreach-job").selectOption({ label: job.title })
  await sheet
    .locator("#outreach-message")
    .fill("Hi Amina, your Elixir work fits our payments team well.")
  await sheet.getByRole("button", { name: /^Send · \d+ credits$/ }).click()
  await expect(sheet.getByText(/Sent\. They'll find your message/)).toBeVisible({ timeout: 10_000 })
  expect(await companyBalance(rec.email)).toBe(before - 5)

  // Live on the seeker side; Interested is free.
  await expect(seekerPage.getByText(/reached out about/).first()).toBeVisible({ timeout: 10_000 })
  await seekerPage.getByRole("button", { name: "Interested", exact: true }).click()
  await expect(seekerPage.getByText("Great, you're in").first()).toBeVisible({ timeout: 10_000 })

  const cands = await api<any>("GET", "/applications/candidates", undefined, rec.token)
  const list: any[] = Array.isArray(cands) ? cands : cands.items
  const card = list.find((c) => c.jobId === job.id)
  expect(card?.status).toBe("APPLIED")
  expect(card?.source).toBe("OUTREACH")
  expect(card?.email).toBe(seeker.email)
})

test("external tracker: a seeker tracks a job from elsewhere and moves its stage", async ({
  page,
}) => {
  const seeker = await createUser("SEEKER", "Ruth")
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/applications`)
  await page.getByRole("button", { name: "Track a job" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "Add job" }).click()
  await expect(dialog.getByText("Enter the company")).toBeVisible()
  await dialog.locator("#ext-company").fill("Stripe")
  await dialog.locator("#ext-title").fill("Payments Engineer")
  await dialog.locator("#ext-url").fill("https://stripe.com/jobs/123")
  await dialog.getByRole("button", { name: "Add job" }).click()
  await expect(page.getByText("Added to your tracker").first()).toBeVisible()
  await page.getByLabel("Stage for Payments Engineer").selectOption("INTERVIEWING")
  await expect(page.getByText(/Interviewing · 1/)).toBeVisible()
  const rows = await api<any[]>("GET", "/external-applications", undefined, seeker.token)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ company: "Stripe", stage: "INTERVIEWING" })
})

test("jobs from the web: apply charges once, opens the posting and auto-tracks it", async ({
  page,
  context,
}) => {
  const seeker = await createUser("SEEKER", "Leul")
  const title = `E2E Web Job ${uid()}`
  const postingUrl = `${SEEKER_URL}/terms?posting=${uid()}`
  await createWebJob(title, postingUrl)
  const before = await seekerBalance(seeker.email)

  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/discover`)
  await page.getByRole("button", { name: "From the web" }).click()
  await page.locator("#web-q").fill(title)
  await page.getByRole("button", { name: "Search", exact: true }).click()
  await page.getByText(title, { exact: true }).first().click()
  // Remotive requires naming the source: one small line; no "via", no raw posting URL anywhere.
  await expect(page.getByTestId("source-attribution")).toHaveText("Listing from Remotive")
  await expect(page.getByText(/^via /)).toHaveCount(0)
  await expect(page.getByText(postingUrl)).toHaveCount(0)
  expect(await page.content()).not.toContain("posting=")
  // No logo from the provider: initials avatar.
  await expect(page.getByText("G", { exact: true }).first()).toBeVisible()
  const listed = await api(
    "GET",
    `/external-jobs?q=${encodeURIComponent(title)}`,
    undefined,
    seeker.token
  )
  expect(listed.items[0]).not.toHaveProperty("url")

  const [posting] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("button", { name: /^Apply · 1 credit$/ }).click(),
  ])
  await expect.poll(() => posting.url()).toContain("/terms?posting=")
  await expect(page.getByText("Opened the application").first()).toBeVisible()
  expect(await seekerBalance(seeker.email)).toBe(before - 1)
  const tracked = await trackedJobs(seeker.email)
  expect(tracked.map((t) => [t.title, t.stage])).toEqual([[title, "APPLIED"]])

  // Reopening is free.
  const [again] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("button", { name: "Open the posting" }).click(),
  ])
  await expect.poll(() => again.url()).toContain("/terms?posting=")
  expect(await seekerBalance(seeker.email)).toBe(before - 1)
})

test("CV tailor: without an AI provider the button is off, explained, and nothing is charged", async ({
  page,
}) => {
  const rec = await createUser("RECRUITER", "Saba")
  const seeker = await createUser("SEEKER", "Yared")
  await setSeekerProfile(seeker.email, { title: "Backend Engineer", skills: ["Go", "PostgreSQL"] })
  const title = `E2E Tailor Job ${uid()}`
  await api(
    "POST",
    "/jobs",
    {
      title,
      location: "Remote",
      type: "FULL_TIME",
      description: "<p>Go services on Kubernetes.</p>",
      requirements: ["Go"],
      skills: ["Go", "Kubernetes"],
      categoryId: await firstCategoryId(),
    },
    rec.token
  )
  const before = await seekerBalance(seeker.email)
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/discover`)
  await page
    .getByRole("tab", { name: "All jobs" })
    .or(page.getByRole("button", { name: "All jobs" }))
    .first()
    .click()
  await page.getByText(title).first().click()
  // The price comes from GET /billing/pricing (2 by default), never a client-side guess.
  const tailor = page.getByRole("button", { name: "Tailor my CV · 2 credits" })
  await expect(tailor).toBeDisabled()
  await expect(page.getByText(/AI tools are switched off on Hyrr right now/).first()).toBeVisible()
  expect(await seekerBalance(seeker.email)).toBe(before)
})

test("practice interview: offered on active applications; without AI, Start is off and explained", async ({
  page,
}) => {
  const rec = await createUser("RECRUITER", "Kebede")
  const seeker = await createUser("SEEKER", "Hiwot")
  const title = `E2E Practice Job ${uid()}`
  const job = await api(
    "POST",
    "/jobs",
    {
      title,
      location: "Remote",
      type: "FULL_TIME",
      description: "<p>Practice makes perfect.</p>",
      requirements: ["Go"],
      skills: ["Go"],
      categoryId: await firstCategoryId(),
    },
    rec.token
  )
  await api(
    "POST",
    `/applications/jobs/${job.id}/apply`,
    { name: "Hiwot", email: seeker.email, title: "Dev", location: "Remote" },
    seeker.token
  )
  const before = await seekerBalance(seeker.email)
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/applications`)
  await page.getByRole("button", { name: "Practice interview" }).first().click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("button", { name: "Start · 3 credits" })).toBeDisabled()
  await expect(dialog.getByText(/AI tools are switched off on Hyrr right now/)).toBeVisible()
  expect(await seekerBalance(seeker.email)).toBe(before)
})

test("discover: the Hyrr job list scrolls on its own and loads every page once", async ({
  page,
}) => {
  const rec = await createUser("RECRUITER", "Liya")
  const prefix = `E2E Scroll ${uid()}`
  await createActiveJobs(rec.email, 25, prefix)
  const seeker = await createUser("SEEKER", "Dawit")
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/discover`)
  await page
    .getByRole("tab", { name: "All jobs" })
    .or(page.getByRole("button", { name: "All jobs" }))
    .first()
    .click()
  const list = page.getByTestId("hyrr-job-list")
  await expect(list.getByText(`${prefix} 25`)).toBeVisible()
  // Own scroll container: scrolling it never moves the page.
  expect(await list.evaluate((el) => getComputedStyle(el).overflowY)).toBe("auto")
  const pageY = await page.evaluate(() => window.scrollY)
  const end = list.getByTestId("list-end")
  for (let i = 0; i < 30 && !(await end.isVisible()); i++) {
    await list.evaluate((el) => el.scrollTo({ top: el.scrollHeight }))
    await page.waitForTimeout(300)
  }
  await expect(end).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(pageY)
  // Every created job exactly once (no duplicate pages).
  const titles = await list.getByText(new RegExp(`^${prefix} \\d+$`)).allInnerTexts()
  expect(titles).toHaveLength(25)
  expect(new Set(titles).size).toBe(25)
})

test("profile: experience and education entries edit in place; preferred categories persist", async ({
  page,
}) => {
  const seeker = await createUser("SEEKER", "Rahel")
  await setSeekerProfile(seeker.email, { title: "Developer", skills: ["Go"] })
  await api(
    "POST",
    "/profile/experience",
    { role: "Developer", company: "Acme", startDate: "2021-03", current: true },
    seeker.token
  )
  await api(
    "POST",
    "/profile/education",
    { school: "AAU", degree: "BSc", startYear: 2015, endYear: 2019 },
    seeker.token
  )
  const [category] = await api<{ id: string; name: string }[]>("GET", "/jobs/categories")

  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/profile`)

  await page.getByRole("button", { name: "Edit Developer" }).click()
  await page.locator("#pf-exp-role").fill("Senior Developer")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Senior Developer", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Edit BSc" }).click()
  await page.locator("#pf-edu-degree").fill("MSc")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByRole("button", { name: "Edit MSc" })).toBeAttached()

  await page
    .getByRole("group", { name: "Preferred categories" })
    .getByRole("button", { name: category.name, exact: true })
    .click()
  await page.getByRole("button", { name: "Save Profile" }).click()
  await expect(page.getByText("Profile saved").first()).toBeVisible()

  await page.reload()
  await expect(page.getByText("Senior Developer", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Edit MSc" })).toBeAttached()
  await expect(
    page
      .getByRole("group", { name: "Preferred categories" })
      .getByRole("button", { name: category.name, exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  const profile = await api("GET", "/profile", undefined, seeker.token)
  expect(profile.interests.map((c: any) => c.id)).toEqual([category.id])
})

test("discover filters: category and salary narrow the list server-side; cards show skills, salary, remote and category", async ({
  page,
}) => {
  const rec = await createUser("RECRUITER", "Mekdes")
  const cats = await api<{ id: string; name: string }[]>("GET", "/jobs/categories")
  const [a, b] = [cats[0], cats[1]]
  const tag = uid()
  await createActiveJobs(rec.email, 1, `E2E Filter A ${tag}`, {
    categoryId: a.id,
    remote: true,
    skills: ["Go", "Postgres", "Docker", "Kubernetes"],
    salaryMin: 90000,
    salaryMax: 120000,
    salaryCurrency: "USD",
    salaryPeriod: "YEAR",
    salary: "USD 90,000 – 120,000 / year",
  })
  await createActiveJobs(rec.email, 1, `E2E Filter B ${tag}`, { categoryId: b.id })
  const seeker = await createUser("SEEKER", "Abebe")
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/discover`)
  await page
    .getByRole("tab", { name: "All jobs" })
    .or(page.getByRole("button", { name: "All jobs" }))
    .first()
    .click()
  const list = page.getByTestId("hyrr-job-list")
  await expect(list.getByText(`E2E Filter B ${tag} 01`)).toBeVisible()

  await page.locator("#hyrr-category").selectOption(a.id)
  const cardA = list.getByRole("button", { name: new RegExp(`E2E Filter A ${tag}`) })
  await expect(cardA).toBeVisible()
  await expect(list.getByText(`E2E Filter B ${tag} 01`)).toHaveCount(0)
  await expect(
    cardA.getByTestId("job-card-meta").getByText("Remote", { exact: true })
  ).toBeVisible()
  await expect(cardA.getByText(a.name)).toBeVisible()
  await expect(cardA.getByRole("list", { name: "Key skills" })).toContainText("Go")
  await expect(cardA.getByText("+1")).toBeVisible()
  await expect(cardA.getByText(/USD 90,000/)).toBeVisible()

  // Salary filter: a minimum above the range hides the job; errors stay inline.
  await page.getByRole("button", { name: "Salary", exact: true }).click()
  await page.locator("#hyrr-salary").fill("200000")
  await page.getByRole("button", { name: "Apply salary" }).click()
  await expect(list.getByText(`E2E Filter A ${tag} 01`)).toHaveCount(0)
  await page.getByRole("button", { name: "Clear filters" }).click()
  await expect(list.getByText(`E2E Filter B ${tag} 01`)).toBeVisible()
})

test("relevance: web jobs rank for the profile and Refresh re-ranks after a profile change", async ({
  page,
}) => {
  const tag = uid()
  await createWebJob(`Rank ${tag} Go Developer`, `${SEEKER_URL}/terms?go=${tag}`)
  await createWebJob(`Rank ${tag} Florist`, `${SEEKER_URL}/terms?fl=${tag}`) // newer
  const seeker = await createUser("SEEKER", "Selam")
  await setSeekerProfile(seeker.email, { title: "Go Developer", skills: ["Go"] })

  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/discover`)
  await page.getByRole("button", { name: "From the web" }).click()
  await page.locator("#web-q").fill(`Rank ${tag}`)
  await page.getByRole("button", { name: "Search", exact: true }).click()
  const list = page.getByTestId("web-job-list")
  const firstTitle = () => list.locator("li button p").first()
  await expect(firstTitle()).toHaveText(`Rank ${tag} Go Developer`)

  await setSeekerProfile(seeker.email, { title: "Florist", skills: ["Floristry"] })
  await page.getByRole("button", { name: "Refresh" }).click()
  await expect(firstTitle()).toHaveText(`Rank ${tag} Florist`)
})

test("LinkedIn import: guided PDF export, PDF only, then the same CV import pipeline", async ({
  page,
}) => {
  const seeker = await createUser("SEEKER", "Bethel")
  // e2e runs without an AI key: show the AI tools as available in the browser only, so the flow
  // reaches the real backend, which answers AI_DISABLED like it does for a CV.
  await page.route("**/api/billing/pricing", async (route) => {
    const res = await route.fetch()
    const body = await res.json()
    await route.fulfill({
      response: res,
      json: { ...body, features: { ...body.features, ai: true } },
    })
  })
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/profile`)
  await expect(page.getByRole("button", { name: "Import from CV" })).toBeVisible()
  await page.getByRole("button", { name: "Import your LinkedIn profile" }).click()

  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("heading", { name: "Import your LinkedIn profile" })).toBeVisible()
  const steps = dialog.getByRole("list", { name: "How to save your LinkedIn profile as a PDF" })
  await expect(steps.getByRole("listitem")).toHaveCount(4)
  await expect(steps).toContainText("Save to PDF")
  // No CV picker: the LinkedIn PDF is always a fresh upload.
  await expect(dialog.getByText("Which CV?")).toBeHidden()

  const input = dialog.getByLabel("LinkedIn PDF")
  await input.setInputFiles({
    name: "Profile.docx",
    mimeType: "application/msword",
    buffer: Buffer.from("x"),
  })
  await expect(dialog.getByRole("alert")).toHaveText(/Choose the PDF you saved from LinkedIn/)

  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
  )
  await input.setInputFiles({ name: "Profile.pdf", mimeType: "application/pdf", buffer: pdf })
  await dialog.getByRole("button", { name: "Read PDF" }).click()
  // Same pipeline as a CV: upload → POST /profile/import-cv → extractProfileFromCv.
  await expect(dialog.getByRole("alert")).toBeVisible({ timeout: 15_000 })
})

test("languages: jobs default to English; Match my languages keeps jobs in the seeker's languages", async ({
  page,
}) => {
  const rec = await createUser("RECRUITER", "Tsion")
  const tag = uid()
  await createActiveJobs(rec.email, 1, `Lang ${tag} Amharic`, { languages: ["Amharic"] })
  await createActiveJobs(rec.email, 1, `Lang ${tag} English`) // column default: English
  const seeker = await createUser("SEEKER", "Kidus")
  await setSeekerProfile(seeker.email, {
    title: "Support agent",
    skills: ["Support"],
    languages: ["amharic (native)"],
  })

  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/discover`)
  await page
    .getByRole("tab", { name: "All jobs" })
    .or(page.getByRole("button", { name: "All jobs" }))
    .first()
    .click()
  const list = page.getByTestId("hyrr-job-list")
  const toggle = page.getByRole("button", { name: "Match my languages" })
  if ((await toggle.getAttribute("aria-pressed")) !== "true") await toggle.click()
  await expect(toggle).toHaveAttribute("aria-pressed", "true")
  await expect(list.getByText(`Lang ${tag} Amharic 01`)).toBeVisible()
  await expect(list.getByText(`Lang ${tag} English 01`)).toHaveCount(0)
  await list.getByText(`Lang ${tag} Amharic 01`).click()
  await expect(page.getByTestId("job-languages")).toHaveText("Amharic")

  await toggle.click()
  await expect(list.getByText(`Lang ${tag} English 01`)).toBeVisible()
  await list.getByText(`Lang ${tag} English 01`).click()
  await expect(page.getByTestId("job-languages")).toHaveText("English")
})

test("pricing: all prices and switches come from the server; recruiters load them at startup", async ({
  page,
  browser,
}) => {
  const seeker = await createUser("SEEKER", "Selam")
  const pricing = await api("GET", "/billing/pricing", undefined, seeker.token)
  expect(pricing).toMatchObject({
    applyCost: expect.any(Number),
    outreachCost: expect.any(Number),
    externalApplyCost: expect.any(Number),
    resumeTailorCost: expect.any(Number),
    mockInterviewCost: expect.any(Number),
    negotiationAdviceCost: expect.any(Number),
    features: { ai: false, webJobs: true },
  })

  // The recruiter app asks for the catalog while it boots (no screen has to open it first).
  const rec = await createUser("RECRUITER", "Abel")
  const loaded = page.waitForResponse(
    (r) => r.url().endsWith("/api/billing/pricing") && r.status() === 200
  )
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, RECRUITER_URL, rec.email)
  const body = await (await loaded).json()
  expect(body.outreachCost).toBe(pricing.outreachCost)

  // Seeker: no AI chat launcher without AI; web jobs offered while the server has them on.
  // Own context: the recruiter's session cookie would otherwise sign this tab in too.
  const seekerPage = await (
    await browser.newContext({ viewport: { width: 1400, height: 900 } })
  ).newPage()
  await login(seekerPage, SEEKER_URL, seeker.email)
  await seekerPage.goto(`${SEEKER_URL}/discover`)
  await expect(seekerPage.getByRole("button", { name: "From the web" })).toBeVisible()
  await expect(seekerPage.getByText(/AI tools are switched off/)).toHaveCount(0)
  await seekerPage.goto(`${SEEKER_URL}/profile`)
  await expect(seekerPage.getByRole("button", { name: "Import from CV" })).toBeDisabled()
  await expect(seekerPage.getByText(/AI tools are switched off on Hyrr right now/)).toBeVisible()
})

test("skill badge: a seeker passes a timed test and gets Verified", async ({ page }) => {
  const key = await seedSkillQuestions("SQL")
  const seeker = await createUser("SEEKER", "Meron")
  await setSeekerProfile(seeker.email, { title: "Analyst", skills: ["SQL", "Hardworking"] })
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, SEEKER_URL, seeker.email)
  await page.goto(`${SEEKER_URL}/profile`)
  // A personal quality on the profile is listed but can't be tested (no AI needed to say so).
  const soft = page.locator("li").filter({ hasText: /^Hardworking/ })
  await expect(soft.getByText("Not testable")).toBeVisible()
  await expect(soft.getByRole("button", { name: "Take test" })).toHaveCount(0)

  const row = page.locator("li").filter({ hasText: /^SQL/ })
  const started = page.waitForResponse(
    (r) => r.url().endsWith("/api/seeker-ai/skills/tests") && r.request().method() === "POST"
  )
  await row.getByRole("button", { name: "Take test" }).click()
  // The answer key never leaves the server.
  const payload = await (await started).text()
  expect(payload).not.toMatch(/correctIndex|explanation|reportCount/)
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("SQL test")).toBeVisible()
  const sets = dialog.locator("fieldset")
  await expect(sets).toHaveCount(10)
  await dialog.getByRole("button", { name: "Report question 1", exact: true }).click()
  await expect(dialog.getByRole("button", { name: "Report question 1", exact: true })).toHaveText("Reported")
  for (let i = 0; i < 10; i++) {
    const legend = (await sets.nth(i).locator("legend").innerText()).replace(/^\d+\.\s*/, "")
    await sets.nth(i).getByText(key.get(legend)!, { exact: true }).click()
  }
  await dialog.getByRole("button", { name: "Submit answers" }).click()
  await expect(dialog.getByText("100%")).toBeVisible({ timeout: 10_000 })
  await expect(dialog.getByText("You're verified in SQL!")).toBeVisible()
  await dialog.getByRole("button", { name: "Done" }).click()
  await expect(row.getByText(/Verified until/)).toBeVisible()
})

test("scam signals: a risky posting goes to moderation instead of going live", async () => {
  const rec = await createUser("RECRUITER", "Zelalem")
  const job = await api(
    "POST",
    "/jobs",
    {
      title: `E2E Risky Job ${uid()}`,
      location: "Remote",
      type: "FULL_TIME",
      description:
        "<p>Earn $300 per day from home! Message t.me/quickjobs or hr.team@gmail.com</p>",
      requirements: ["None"],
      skills: ["Typing"],
      categoryId: await firstCategoryId(),
    },
    rec.token
  )
  expect(job.status).toMatch(/FLAGGED/i)
  const publicJobs = await api<any>("GET", "/jobs/public")
  const items: any[] = Array.isArray(publicJobs) ? publicJobs : (publicJobs.items ?? [])
  expect(items.some((j) => j.id === job.id)).toBe(false)
})

test("reject kindly: the candidate gets a respectful message and is archived", async ({ page }) => {
  const rec = await createUser("RECRUITER", "Mahlet")
  const seeker = await createUser("SEEKER", "Bereket")
  const job = await api(
    "POST",
    "/jobs",
    {
      title: `E2E Kind Reject ${uid()}`,
      location: "Remote",
      type: "FULL_TIME",
      description: "<p>We reply to every applicant, always with respect.</p>",
      requirements: ["Go"],
      skills: ["Go"],
      categoryId: await firstCategoryId(),
    },
    rec.token
  )
  const app = await api(
    "POST",
    `/applications/jobs/${job.id}/apply`,
    { name: "Bereket", email: seeker.email, title: "Dev", location: "Remote" },
    seeker.token
  )
  await page.setViewportSize({ width: 1400, height: 900 })
  await login(page, RECRUITER_URL, rec.email)
  await page.goto(`${RECRUITER_URL}/applications`)
  await page
    .getByRole("button", { name: /^list$/i })
    .first()
    .click()
  await page.getByText("Bereket", { exact: true }).first().click()
  await page.getByRole("button", { name: "Reject kindly" }).click()
  await expect(page.locator("#reject-message")).toHaveValue(/Thank you for applying/)
  await page.getByRole("button", { name: "Send and archive" }).click()
  await expect(page.getByText("Candidate informed").first()).toBeVisible({ timeout: 10_000 })

  const mine = await api<any[]>("GET", "/applications/my", undefined, seeker.token)
  expect(mine.find((a) => a.id === app.id)?.status).toBe("ARCHIVED")
  const notes = await api<any>("GET", "/notifications", undefined, seeker.token)
  const list: any[] = Array.isArray(notes) ? notes : (notes.items ?? [])
  expect(list.some((n) => /application for .* was sent/i.test(n.title))).toBe(true)
})

test("public job page: readable signed-out, Google JobPosting data, sitemap, widget and deep link", async ({
  page,
}) => {
  const rec = await createUser("RECRUITER", "Selamawit")
  const seeker = await createUser("SEEKER", "Dagim")
  const title = `E2E Public Job ${uid()}`
  const job = await api(
    "POST",
    "/jobs",
    {
      title,
      location: "Addis Ababa, Ethiopia",
      type: "FULL_TIME",
      description: "<p>Build the future of hiring in East Africa with a kind, ambitious team.</p>",
      requirements: ["TypeScript"],
      skills: ["TypeScript"],
      salaryMin: 40000,
      salaryMax: 60000,
      salaryCurrency: "USD",
      salaryPeriod: "YEAR",
      categoryId: await firstCategoryId(),
    },
    rec.token
  )

  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto(`${SEEKER_URL}/jobs/${job.id}`)
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 20_000 })
  const ld = JSON.parse((await page.locator("#job-posting-ld").textContent())!)
  expect(ld).toMatchObject({
    "@type": "JobPosting",
    title,
    employmentType: "FULL_TIME",
    hiringOrganization: { name: "Selamawit Studio" },
    jobLocation: { address: { addressLocality: "Addis Ababa", addressCountry: "Ethiopia" } },
    baseSalary: { currency: "USD", value: { minValue: 40000, maxValue: 60000, unitText: "YEAR" } },
  })

  const sitemap = await (await fetch(`${API}/public/sitemap.xml`)).text()
  expect(sitemap).toContain(`/jobs/${job.id}</loc>`)
  const companyId = (await api<any>("GET", "/auth/me", undefined, rec.token)).company.id
  const widget = await (await fetch(`${API}/public/companies/${companyId}/jobs.js`)).text()
  expect(widget).toContain(`/jobs/${job.id}`)

  // Apply on Hyrr → sign in → Discover opens this job.
  await page.getByRole("button", { name: "Apply on Hyrr" }).click()
  await page.locator("#auth-email").fill(seeker.email)
  await page.locator("#auth-password").fill(PASSWORD)
  await page.locator("#auth-submit").click()
  await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible({
    timeout: 20_000,
  })
})
