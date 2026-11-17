import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { corsOrigins, env, isProduction } from "./config/env.js";
import type { AppDatabase } from "./db/client.js";
import { registerRoutes } from "./routes.js";
import { registerErrorHandlers } from "./shared/http/error-handler.js";

export type BuildAppOptions = {
  db: AppDatabase;
  logger?: FastifyServerOptions["logger"];
};

export async function buildApp({
  db,
  logger,
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: true,
    logger:
      logger ??
      (isProduction
        ? { level: env.LOG_LEVEL }
        : {
            level: env.LOG_LEVEL,
            transport: {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "SYS:standard",
                ignore: "pid,hostname",
              },
            },
          }),
  });

  app.decorate("db", db);
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  await app.register(cors, {
    origin: corsOrigins.includes("*") ? true : corsOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
    maxAge: 86400,
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    hook: "onRequest",
  });

  if (env.ENABLE_SWAGGER) {
    await app.register(swagger, {
      openapi: {
        info: {
          title: "NyayaSetu API",
          version: "0.1.0",
          description:
            "Content, advocate discovery, legal intake, conflict-check, and newsletter API for the NyayaSetu platform. Preliminary AI assessments are not legal advice and do not create an advocate-client relationship.",
        },
        servers: [{ url: env.PUBLIC_BASE_URL }],
        tags: [
          { name: "System", description: "Health and readiness probes" },
          { name: "Site", description: "Brand, offices, languages and legal notices" },
          { name: "Practices", description: "Practice areas and fee bands" },
          { name: "Advocates", description: "Verified advocate directory" },
          { name: "Matters", description: "Representative matters and outcomes" },
          { name: "Insights", description: "Legal guides and publications" },
          { name: "Catalog", description: "FAQs, testimonials and fixed-fee packages" },
          { name: "Intake", description: "Legal assessment, conflict-check and consultation intake" },
          { name: "Newsletter", description: "Quarterly briefing subscriptions" },
        ],
      },
      transform: jsonSchemaTransform,
    });

    await app.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
      },
      staticCSP: true,
    });
  }

  registerErrorHandlers(app);
  await app.register(registerRoutes);

  return app;
}
