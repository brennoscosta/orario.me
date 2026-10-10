import "server-only";
import { inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

const TTL_MS = 15_000;
const store = globalThis as unknown as { __orarioSettings?: { at: number; values: Map<string, string> } };

/** All settings saved in the admin panel. Cached briefly; empty when the database is unavailable. */
export async function getSettings(): Promise<Map<string, string>> {
  const cached = store.__orarioSettings;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.values;
  const values = new Map<string, string>();
  if (process.env.DATABASE_URL) {
    try {
      const rows = await getDb().select().from(schema.settings);
      for (const row of rows) values.set(row.key, row.value);
    } catch (err) {
      console.warn("[orario] could not read settings:", (err as Error).message);
      return cached?.values ?? values;
    }
  }
  store.__orarioSettings = { at: Date.now(), values };
  return values;
}

/** Saves the given keys. An empty string removes the key. */
export async function saveSettings(entries: Record<string, string>): Promise<void> {
  const db = getDb();
  const remove = Object.keys(entries).filter((k) => entries[k] === "");
  const upsert = Object.entries(entries)
    .filter(([, v]) => v !== "")
    .map(([key, value]) => ({ key, value, updatedAt: new Date() }));
  if (remove.length > 0) await db.delete(schema.settings).where(inArray(schema.settings.key, remove));
  if (upsert.length > 0) {
    await db
      .insert(schema.settings)
      .values(upsert)
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: sql`excluded.value`, updatedAt: new Date() } });
  }
  store.__orarioSettings = undefined;
}
