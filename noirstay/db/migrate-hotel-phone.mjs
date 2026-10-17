// One-off migration: add phone to hotels (fetched from liteAPI hotel details).
// Safe to re-run.
import { Pool } from "pg";
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!dbUrl) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });
const sql = `ALTER TABLE hotels ADD COLUMN IF NOT EXISTS phone TEXT;`;
try {
  await pool.query(sql);
  const { rows } = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'hotels' AND column_name = 'phone'"
  );
  console.log("migration ok:", rows.length ? "phone column present" : "column missing!");
  process.exit(rows.length ? 0 : 1);
} catch (err) {
  console.error("migration failed:", err);
  process.exit(1);
} finally {
  await pool.end();
}
