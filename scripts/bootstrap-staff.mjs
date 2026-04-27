import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function ensureUser(adminClient, { email, password, fullName, role }) {
  const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) throw new Error(`Could not list users: ${listError.message}`);

  const existing = listData.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

  let userId = existing?.id;
  if (!userId) {
    const { data: createdData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !createdData.user?.id) {
      throw new Error(`Could not create user ${email}: ${createError?.message ?? "unknown error"}`);
    }
    userId = createdData.user.id;
    console.log(`Created auth user: ${email}`);
  } else {
    console.log(`Auth user already exists: ${email}`);
  }

  const { error: profileError } = await adminClient.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      role,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    throw new Error(`Could not upsert profile for ${email}: ${profileError.message}`);
  }
  console.log(`Profile ready: ${email} (${role})`);
}

async function main() {
  loadDotEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in env.");
  if (!serviceRole) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in env.");

  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL ?? "admin@dormitorios.local";
  const receptionEmail = process.env.BOOTSTRAP_RECEPTION_EMAIL ?? "recepcion@dormitorios.local";
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const receptionPassword = process.env.BOOTSTRAP_RECEPTION_PASSWORD;

  if (!adminPassword || !receptionPassword) {
    throw new Error(
      "Missing BOOTSTRAP_ADMIN_PASSWORD / BOOTSTRAP_RECEPTION_PASSWORD in env.",
    );
  }

  const adminClient = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await ensureUser(adminClient, {
    email: adminEmail,
    password: adminPassword,
    fullName: "Administración Dormitorios",
    role: "admin",
  });

  await ensureUser(adminClient, {
    email: receptionEmail,
    password: receptionPassword,
    fullName: "Recepción Dormitorios",
    role: "reception",
  });

  console.log("\nBootstrap complete. You can now log in at /login.");
  console.log(`Admin: ${adminEmail}`);
  console.log(`Reception: ${receptionEmail}`);
}

main().catch((error) => {
  console.error(`\nBootstrap failed: ${error.message}`);
  process.exit(1);
});
