export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) {
    console.warn("[orario] DATABASE_URL is not set: accounts and reminders are disabled");
    return;
  }
  const { bootDatabase } = await import("./db/boot");
  const { startScheduler } = await import("./lib/scheduler");
  try {
    await bootDatabase();
    startScheduler();
  } catch (err) {
    console.error("[orario] database boot failed:", err);
  }
}
