export const channels = ["email", "whatsapp", "sms"] as const;
export type Channel = (typeof channels)[number];

export function isChannel(value: string): value is Channel {
  return (channels as readonly string[]).includes(value);
}

/** Monthly sends per channel. `null` means no limit. */
export const planLimits: Record<string, Record<Channel, number | null>> = {
  free: { email: null, whatsapp: 30, sms: 5 },
};

export function limitFor(plan: string, channel: Channel): number | null {
  return (planLimits[plan] ?? planLimits.free)[channel];
}

/** Minutes before the activity. 0 means "at the time". */
export const offsetOptions = [0, 10, 30, 60, 120, 1440, 2880, 10080] as const;

export const MAX_REMINDERS_PER_ACTIVITY = 4;
