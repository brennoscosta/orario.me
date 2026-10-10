import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { channels, type Channel } from "./plans";

function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function usedThisMonth(userId: string, channel: Channel): Promise<number> {
  const rows = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.deliveries)
    .where(
      and(
        eq(schema.deliveries.userId, userId),
        eq(schema.deliveries.channel, channel),
        gte(schema.deliveries.sentAt, monthStart()),
      ),
    );
  return rows[0]?.n ?? 0;
}

export async function usageThisMonth(userId: string): Promise<Record<Channel, number>> {
  const rows = await getDb()
    .select({ channel: schema.deliveries.channel, n: sql<number>`count(*)::int` })
    .from(schema.deliveries)
    .where(and(eq(schema.deliveries.userId, userId), gte(schema.deliveries.sentAt, monthStart())))
    .groupBy(schema.deliveries.channel);
  const out = Object.fromEntries(channels.map((c) => [c, 0])) as Record<Channel, number>;
  for (const row of rows) if (row.channel in out) out[row.channel as Channel] = row.n;
  return out;
}
