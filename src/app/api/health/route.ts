import { getSql } from "@/db";
import { configuredChannels } from "@/lib/channels";

export const dynamic = "force-dynamic";

export async function GET() {
  let database = false;
  if (process.env.DATABASE_URL) {
    try {
      await getSql()`select 1`;
      database = true;
    } catch {
      database = false;
    }
  }
  return Response.json({ ok: true, database, channels: await configuredChannels() });
}
