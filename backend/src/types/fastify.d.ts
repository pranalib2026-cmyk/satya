import type { AppDatabase } from "../db/client.js";

declare module "fastify" {
  interface FastifyInstance {
    db: AppDatabase;
  }
}
