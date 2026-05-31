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
const migrationPath = path.join(__dirname, "../supabase/migrations/20260531_guest_wallets.sql");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    "Missing DATABASE_URL.\n\nExample:\n  DATABASE_URL=\"postgresql://postgres:YOUR_PASSWORD@db.yhwcwmkuhefzbtilcmoo.supabase.co:5432/postgres\" npm run db:apply-guest-wallets",
  );
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, "utf8");

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("Applying guest_wallets migration…");
  await client.query(sql);
  await client.query("NOTIFY pgrst, 'reload schema';");
  console.log("Done. guest_wallets table is ready.");
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await client.end();
}
