import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { createDatabase } from "./db/client.js";

const database = createDatabase();
const app = await buildApp({ db: database.db });

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, "Shutting down");
  try {
    await app.close();
  } finally {
    database.close();
  }
};

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal).then(() => process.exit(0));
  });
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info(
    `NyayaSetu API listening on ${env.PUBLIC_BASE_URL}${env.API_PREFIX}`,
  );
} catch (error) {
  app.log.error(error);
  database.close();
  process.exit(1);
}
