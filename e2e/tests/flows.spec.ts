import { expect, test } from "@playwright/test"
import {
  api,
  companyBalance,
  createUser,
  detachFromCompany,
  disconnect,
  firstCategoryId,
  login,
  PASSWORD,
  RECRUITER_URL,
  SEEKER_URL,
  seekerBalance,
  setInviteToken,
  setSeekerProfile,
  setUserStatus,
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
