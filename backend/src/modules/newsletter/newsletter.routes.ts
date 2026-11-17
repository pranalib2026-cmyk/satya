import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { newsletterSubscribers } from "../../db/schema.js";

const newsletterBodySchema = z.object({
  email: z.email().max(254),
  source: z.string().trim().max(80).default("website"),
});

export const newsletterRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/newsletter",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
      schema: {
        tags: ["Newsletter"],
        summary: "Subscribe to the quarterly legal briefing",
        body: newsletterBodySchema,
      },
    },
    async (request, reply) => {
      const email = request.body.email.toLowerCase();

      const subscriber = request.server.db
        .insert(newsletterSubscribers)
        .values({
          id: randomUUID(),
          email,
          status: "subscribed",
          source: request.body.source,
        })
        .onConflictDoUpdate({
          target: newsletterSubscribers.email,
          set: {
            status: "subscribed",
            source: request.body.source,
            updatedAt: new Date(),
          },
        })
        .returning()
        .get();

      return reply.status(202).send({
        data: {
          email: subscriber.email,
          status: subscriber.status,
          subscribedAt: subscriber.createdAt,
        },
      });
    },
  );
};
