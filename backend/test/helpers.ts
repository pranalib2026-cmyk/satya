import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { createDatabase, type DatabaseConnection } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";
import { seedDatabase } from "../src/db/seed.js";

export type TestApp = {
  app: FastifyInstance;
  database: DatabaseConnection;
  close: () => Promise<void>;
};

export async function createTestApp(
  options: { seed?: boolean } = {},
): Promise<TestApp> {
  const database = createDatabase(":memory:");
  runMigrations(database.db);

  if (options.seed !== false) {
    seedDatabase(database.db);
  }

  const app = await buildApp({ db: database.db, logger: false });
  await app.ready();

  return {
    app,
    database,
    close: async () => {
      await app.close();
      database.close();
    },
  };
}
