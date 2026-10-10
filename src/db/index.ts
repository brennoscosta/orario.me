import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __orarioDb?: Db; __orarioSql?: postgres.Sql };

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

export function getSql(): postgres.Sql {
  if (!globalForDb.__orarioSql) {
    globalForDb.__orarioSql = postgres(databaseUrl(), { max: 10, onnotice: () => {} });
  }
  return globalForDb.__orarioSql;
}

export function getDb(): Db {
  if (!globalForDb.__orarioDb) {
    globalForDb.__orarioDb = drizzle(getSql(), { schema });
  }
  return globalForDb.__orarioDb;
}

export { schema };
