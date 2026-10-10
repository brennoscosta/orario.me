import path from "node:path";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { databaseUrl, getDb } from "./index";

/** Creates the target database when it does not exist yet (first deploy). */
async function ensureDatabase(): Promise<void> {
  const url = new URL(databaseUrl());
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) return;

  const admin = new URL(url.toString());
  admin.pathname = "/postgres";
  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  try {
    const rows = await sql`select 1 from pg_database where datname = ${name}`;
    if (rows.length === 0) {
      await sql.unsafe(`create database "${name}"`);
      console.log(`[orario] database "${name}" created`);
    }
  } catch (err) {
    // Not fatal: the role may lack access to the maintenance database
    // while the target database already exists.
    console.warn("[orario] could not verify database existence:", (err as Error).message);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function bootDatabase(): Promise<void> {
  await ensureDatabase();
  await migrate(getDb(), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("[orario] migrations applied");
}
