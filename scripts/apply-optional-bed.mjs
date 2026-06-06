#!/usr/bin/env node
/**
 * Allows guest-app reservations without a bed assigned at booking time.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres:[PASSWORD]@db.yhwcwmkuhefzbtilcmoo.supabase.co:5432/postgres" \
 *     npm run db:apply-optional-bed
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key]) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, "../.env.local"));
loadEnvFile(path.join(__dirname, "../.env"));

const migrationPath = path.join(
  __dirname,
  "../supabase/migrations/20260604_optional_bed_assignment.sql",
);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    "Missing DATABASE_URL.\n\nExample:\n  DATABASE_URL=\"postgresql://postgres:YOUR_PASSWORD@db.yhwcwmkuhefzbtilcmoo.supabase.co:5432/postgres\" npm run db:apply-optional-bed",
  );
  process.exit(1);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const sql = fs.readFileSync(migrationPath, "utf8");
  console.log("Applying 20260604_optional_bed_assignment.sql…");
  await client.query(sql);
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log("Done. reservation_guests.bed_id is now optional.");
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await client.end();
}
