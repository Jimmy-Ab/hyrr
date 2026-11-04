// Live smoke-test template. Run from the repo root:
//   NODE_PATH=$PWD/node_modules node .claude/skills/hyrr-smoke/template.cjs
// Copy it to a scratch location and extend the scenario section for the feature under test.
const { io } = require("socket.io-client")

const ORIGIN = process.env.SMOKE_ORIGIN || "http://localhost:3101"
const B = `${ORIGIN}/api`
let pass = 0
let fail = 0

const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++
  console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(detail).slice(0, 300))
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(method, path, body, token) {
  const res = await fetch(B + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { s: res.status, d: data }
}

/** Connects a socket and records every event it receives in `socket.events`. */
function sock(token) {
  return new Promise((resolve) => {
    const s = io(ORIGIN, { auth: { token }, transports: ["websocket"], reconnection: false })
    s.events = []
    s.onAny((ev, data) => s.events.push({ ev, data }))
    s.on("connect", () => setTimeout(() => resolve(s), 300))
    s.on("connect_error", () => resolve(s))
  })
}
const countEvents = (s, ev, pred = () => true) => s.events.filter((e) => e.ev === ev && pred(e.data)).length

async function register(name, role, u) {
  const email = `${name.toLowerCase().replace(/\W/g, "")}${u}@example.test`
  const r = await api("POST", "/auth/register", { name, email, password: "Password123!", role })
  return { token: r.d.accessToken, email, status: r.s }
}

;(async () => {
  const u = Date.now()

  // ── Baseline: recruiter posts a job, seeker applies, they exchange a message ──
  const rec = await register("Rita Recruiter", "RECRUITER", u)
  const seek = await register("Sam Seeker", "SEEKER", u)
  check("register recruiter + seeker", rec.token && seek.token, [rec.status, seek.status])

  const cats = await api("GET", "/jobs/categories")
  const job = await api(
    "POST",
    "/jobs",
    {
      title: "Backend Engineer",
      location: "Berlin",
      type: "FULL_TIME",
      description: "<p>Build APIs</p>",
      requirements: ["Node.js"],
      skills: ["TypeScript"],
      categoryId: cats.d[0].id,
    },
    rec.token
  )
  check("create job", job.s === 201 || job.s === 200, job)

  const app = await api(
    "POST",
    `/applications/jobs/${job.d.id}/apply`,
    { name: "Sam Seeker", email: seek.email, title: "Dev", location: "Berlin" },
    seek.token
  )
  check("apply", app.s === 201 || app.s === 200, app)

  const recSock = await sock(rec.token)
  const msg = await api("POST", `/messages/${app.d.id}`, { text: "Hello!", clientId: `c-${u}` }, seek.token)
  await sleep(400)
  check("message sent", msg.s === 201 || msg.s === 200, msg)
  check("recruiter got new_message once", countEvents(recSock, "new_message", (m) => m.text === "Hello!") === 1)

  // ── Feature-specific scenario goes here ──

  recSock.close()
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
