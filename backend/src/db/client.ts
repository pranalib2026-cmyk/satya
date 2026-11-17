import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;

export type DatabaseConnection = {
  db: AppDatabase;
  sqlite: Database.Database;
  close: () => void;
};

function resolveDatabasePath(databaseUrl: string): string {
  if (databaseUrl === ":memory:") {
    return databaseUrl;
  }

  const resolved = path.isAbsolute(databaseUrl)
    ? databaseUrl
    : path.resolve(process.cwd(), databaseUrl);

  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

export function createDatabase(databaseUrl = env.DATABASE_URL): DatabaseConnection {
  const sqlite = new Database(resolveDatabasePath(databaseUrl));

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  const db = drizzle(sqlite, { schema });

  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}
