import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone"),
  locale: text("locale").notNull().default("pt"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  plan: text("plan").notNull().default("free"),
  /** Daily countdown email and the same-day "it's today" email. */
  dailyDigest: boolean("daily_digest").notNull().default(true),
  /** Local hour (0-23) at which the daily email goes out. */
  digestHour: integer("digest_hour").notNull().default(8),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/**
 * Appointments. Every column besides id, userId, title, startsAt and createdAt
 * is a detail field: it shows up by itself in the form, the agenda and the
 * emails (see src/lib/activity-fields.ts for labels and input types).
 */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    location: text("location"),
    notes: text("notes"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activities_user_starts_idx").on(t.userId, t.startsAt)],
);

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    offsetMinutes: integer("offset_minutes").notNull(),
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    deliveredVia: text("delivered_via"),
    error: text("error"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    index("reminders_due_idx").on(t.status, t.sendAt),
    index("reminders_activity_idx").on(t.activityId),
  ],
);

/** Append-only log of sent messages, used for monthly plan limits. */
export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deliveries_user_idx").on(t.userId, t.channel, t.sentAt)],
);

/**
 * Countdown emails already sent, so each goes out once:
 * kind "digest" with key = local day, kind "today" with key = activity + start time.
 */
export const notices = pgTable(
  "notices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    key: text("key").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("notices_once_idx").on(t.userId, t.kind, t.key)],
);

/** Site-wide configuration edited in the admin panel (channel credentials, limits). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
