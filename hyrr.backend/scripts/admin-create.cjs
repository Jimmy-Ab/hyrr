// Creates an admin account, or promotes an existing user to ADMIN.
// Usage: npm run admin:create --workspace=hyrr.backend -- admin@example.com "Full Name"
// A new account gets a random 16-character password, printed once, and a verified e-mail.
// The admin console also requires two-factor login: sign in, then turn on 2FA when asked.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") })
const { randomInt } = require("crypto")
const bcrypt = require("bcrypt")
const { PrismaClient } = require("@prisma/client")

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_"
const randomPassword = (length = 16) => {
  // At least one lower, upper, digit and symbol so it passes the password rules.
  const sets = ["abcdefghijkmnopqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "!@#$%*-_"]
  const chars = sets.map((set) => set[randomInt(set.length)])
  while (chars.length < length) chars.push(ALPHABET[randomInt(ALPHABET.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join("")
}
const avatarFor = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6C63FF&color=fff`

const email = (process.argv[2] || "").trim()
const name = (process.argv[3] || "").trim()
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(
    'Usage: npm run admin:create --workspace=hyrr.backend -- admin@example.com "Full Name"'
  )
  process.exit(1)
}

const prisma = new PrismaClient()

;(async () => {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (existing.role === "ADMIN") {
      console.log(`${email} is already an admin.`)
      return
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } }),
      prisma.auditLog.create({
        data: {
          userId: existing.id,
          action: "admin.create",
          target: `user:${existing.id}`,
          details: `Promoted ${email} to admin (CLI)`,
          meta: { before: { role: existing.role }, after: { role: "ADMIN" } },
          ip: "cli",
          severity: "critical",
        },
      }),
    ])
    console.log(`Promoted ${email} (was ${existing.role}) to ADMIN.`)
    console.log("They sign in with their usual password and must turn on two-factor login.")
    return
  }

  const displayName = name || email.split("@")[0]
  const password = randomPassword()
  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: displayName,
        avatar: avatarFor(displayName),
        role: "ADMIN",
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    })
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "admin.create",
        target: `user:${user.id}`,
        details: `Created admin account ${email} (CLI)`,
        meta: { after: { role: "ADMIN" } },
        ip: "cli",
        severity: "critical",
      },
    })
  })
  console.log(`Created admin ${displayName} <${email}>.`)
  console.log(`One-time password (shown once, change it after signing in): ${password}`)
  console.log("Two-factor login is required: sign in to the admin app and follow the setup steps.")
})()
  .catch((err) => {
    console.error(`Failed: ${err?.message || err}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
