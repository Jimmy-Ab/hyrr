/**
 * Entry point for `npx prisma db seed` / `npm run seed`.
 * - Development: runs prisma/seed.ts through ts-node (no build step needed).
 * - Production / Docker (devDependencies pruned): runs the compiled dist/prisma/seed.js.
 */
const fs = require("fs")
const path = require("path")

const compiled = path.join(__dirname, "..", "dist", "prisma", "seed.js")
const source = path.join(__dirname, "seed.ts")

function canUseTsNode() {
  if (process.env.NODE_ENV === "production" || !fs.existsSync(source)) return false
  try {
    require.resolve("ts-node")
    return true
  } catch {
    return false
  }
}

if (canUseTsNode()) {
  require("ts-node").register({
    transpileOnly: true,
    compilerOptions: { module: "commonjs", target: "es2021", esModuleInterop: true },
  })
  require(source)
} else if (fs.existsSync(compiled)) {
  require(compiled)
} else {
  console.error("No seed script found. Run `npm run build:seed` (or install ts-node) first.")
  process.exit(1)
}
