import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { createDatabase } from "./client.js";
import { runMigrations } from "./migrate.js";
import { seedDatabase } from "./seed.js";

async function main(): Promise<void> {
  if (env.DATABASE_URL !== ":memory:") {
    const databasePath = path.isAbsolute(env.DATABASE_URL)
      ? env.DATABASE_URL
      : path.resolve(process.cwd(), env.DATABASE_URL);

    for (const suffix of ["", "-wal", "-shm"]) {
      const file = `${databasePath}${suffix}`;
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
  }

  const { db, close } = createDatabase();

  try {
    runMigrations(db);
    seedDatabase(db);
    console.log("Database reset complete.");
  } finally {
    close();
  }
}

await main();
