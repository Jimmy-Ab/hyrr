// Removes admin rights: the account goes back to SEEKER (if it has a seeker profile) or RECRUITER.
// Usage: npm run admin:revoke --workspace=hyrr.backend -- admin@example.com
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") })
const { PrismaClient } = require("@prisma/client")

const email = (process.argv[2] || "").trim()
if (!email) {
  console.error("Usage: npm run admin:revoke --workspace=hyrr.backend -- admin@example.com")
  process.exit(1)
}

const prisma = new PrismaClient()

;(async () => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, seekerProfile: { select: { id: true } } },
  })
  if (!user) {
    console.error(`No account with the e-mail ${email}.`)
    process.exitCode = 1
    return
  }
  if (user.role !== "ADMIN") {
    console.log(`${email} is not an admin (role ${user.role}); nothing to do.`)
    return
  }
  const role = user.seekerProfile ? "SEEKER" : "RECRUITER"
  await prisma.$transaction([
    // tokenVersion+1 signs the account out everywhere.
    prisma.user.update({
      where: { id: user.id },
      data: { role, tokenVersion: { increment: 1 } },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "admin.revoke",
        target: `user:${user.id}`,
        details: `Revoked admin rights of ${email} (CLI)`,
        meta: { before: { role: "ADMIN" }, after: { role } },
        ip: "cli",
        severity: "critical",
      },
    }),
  ])
  console.log(
    `Revoked admin rights of ${email}; role is now ${role}. Their sessions were signed out.`
  )
})()
  .catch((err) => {
    console.error(`Failed: ${err?.message || err}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
