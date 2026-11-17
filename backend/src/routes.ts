import type { FastifyPluginAsync } from "fastify";
import { advocatesRoutes } from "./modules/advocates/advocates.routes.js";
import { catalogRoutes } from "./modules/catalog/catalog.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { insightsRoutes } from "./modules/insights/insights.routes.js";
import { intakeRoutes } from "./modules/intake/intake.routes.js";
import { mattersRoutes } from "./modules/matters/matters.routes.js";
import { newsletterRoutes } from "./modules/newsletter/newsletter.routes.js";
import { practicesRoutes } from "./modules/practices/practices.routes.js";
import { siteRoutes } from "./modules/site/site.routes.js";
import { env } from "./config/env.js";

export const registerRoutes: FastifyPluginAsync = async (app) => {
  await app.register(healthRoutes);

  await app.register(
    async (api) => {
      await api.register(siteRoutes);
      await api.register(practicesRoutes);
      await api.register(advocatesRoutes);
      await api.register(mattersRoutes);
      await api.register(insightsRoutes);
      await api.register(catalogRoutes);
      await api.register(intakeRoutes);
      await api.register(newsletterRoutes);

      api.get(
        "/",
        {
          schema: {
            tags: ["System"],
            summary: "API index",
          },
        },
        async () => ({
          data: {
            name: "NyayaSetu API",
            version: "0.1.0",
            environment: env.NODE_ENV,
            docs: env.ENABLE_SWAGGER ? "/docs" : null,
          },
        }),
      );
    },
    { prefix: env.API_PREFIX },
  );
};
