// `npm run build`: on Vercel (VERCEL=1) builds against Postgres and prepares the live database;
// everywhere else it is a normal local build against SQLite.
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

if (process.env.VERCEL) {
  const schema = "prisma/schema.postgres.prisma";
  run("node scripts/prisma-postgres.mjs");
  run(`npx prisma generate --schema ${schema}`);
  run(`npx prisma db push --schema ${schema} --skip-generate`);
  run("npx tsx prisma/prod-init.ts");
} else {
  run("npx prisma generate");
}
run("npx next build");
