import path from "node:path";
import { pathToFileURL } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDatabase, type AppDatabase } from "./client.js";

export const migrationsFolder = path.resolve(process.cwd(), "drizzle");

export function runMigrations(
  db: AppDatabase,
  folder: string = migrationsFolder,
): void {
  migrate(db, { migrationsFolder: folder });
}

async function main(): Promise<void> {
  const { db, close } = createDatabase();

  try {
    runMigrations(db);
    console.log("Database migrations applied.");
  } finally {
    close();
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  await main();
}
