import { readFileSync } from "node:fs";

/**
 * Loads KEY=VALUE lines from the file named by ORARIO_ENV_FILE into
 * process.env. Lets secrets live in a file mounted into the container
 * instead of the app's visible configuration. Existing variables win.
 */
export function loadEnvFile(): void {
  const path = process.env.ORARIO_ENV_FILE;
  if (!path) return;
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch (err) {
    console.warn(`[orario] could not read ${path}:`, (err as Error).message);
    return;
  }
  let loaded = 0;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || process.env[key]) continue;
    process.env[key] = value;
    loaded += 1;
  }
  console.log(`[orario] loaded ${loaded} variable(s) from ${path}`);
}
