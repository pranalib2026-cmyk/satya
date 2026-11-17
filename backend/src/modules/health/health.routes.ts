import { sql } from "drizzle-orm";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["System"],
        summary: "Liveness probe",
        description:
          "Returns 200 while the process is running. Does not check the database.",
      },
    },
    async () => ({
      status: "ok",
      service: "nyayasetu-api",
      version: "0.1.0",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }),
  );

  app.get(
    "/health/ready",
    {
      schema: {
        tags: ["System"],
        summary: "Readiness probe",
        description:
          "Checks that the API can reach its SQLite database. Returns 503 when not ready.",
      },
    },
    async (request, reply) => {
      try {
        request.server.db.run(sql`select 1`);
        return {
          status: "ok",
          checks: { database: "up" },
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        request.log.error({ err: error }, "Readiness check failed");
        return reply.status(503).send({
          status: "unavailable",
          checks: { database: "down" },
          timestamp: new Date().toISOString(),
        });
      }
    },
  );
};
