import "server-only";
import { limitFor, type Channel } from "./plans";
import { getSettings } from "./settings";

/** Monthly limit for a channel, honoring values edited in the admin panel. `null` means no limit. */
export async function monthlyLimit(plan: string, channel: Channel): Promise<number | null> {
  if (channel === "email") return limitFor(plan, channel);
  const saved = (await getSettings()).get(`limits.${channel}`);
  const n = saved === undefined ? NaN : Number(saved);
  return Number.isInteger(n) && n >= 0 ? n : limitFor(plan, channel);
}
