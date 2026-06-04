#!/usr/bin/env node
/**
 * Applies supabase/migrations/20260531_guest_wallets.sql to the linked database.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres:[PASSWORD]@db.yhwcwmkuhefzbtilcmoo.supabase.co:5432/postgres" \
 *     npm run db:apply-guest-wallets
 *
 * Get the database password from Supabase Dashboard → Project Settings → Database.
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
const migrationDir = path.join(__dirname, "../supabase/migrations");
const migrationFiles = process.env.APPLY_GUEST_WALLETS_ONLY
  ? ["20260603_guest_wallets_email.sql"]
  : ["20260531_guest_wallets.sql", "20260603_guest_wallets_email.sql"];

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    "Missing DATABASE_URL.\n\nExample:\n  DATABASE_URL=\"postgresql://postgres:YOUR_PASSWORD@db.yhwcwmkuhefzbtilcmoo.supabase.co:5432/postgres\" npm run db:apply-guest-wallets",
  );
  process.exit(1);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  for (const file of migrationFiles) {
    const migrationPath = path.join(migrationDir, file);
    const sql = fs.readFileSync(migrationPath, "utf8");
    console.log(`Applying ${file}…`);
    await client.query(sql);
  }
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log("Done. guest_wallets schema is up to date.");
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await client.end();
}
