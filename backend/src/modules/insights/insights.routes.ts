import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { notFound } from "../../shared/http/errors.js";
import {
  buildPageMeta,
  paginationQuerySchema,
} from "../../shared/http/pagination.js";
import {
  getInsightBySlugOrId,
  listInsightCategories,
  listInsights,
} from "./insights.service.js";

const insightListQuerySchema = paginationQuerySchema.extend({
  category: z.string().trim().min(1).optional(),
  author: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(120).optional(),
});

const insightParamsSchema = z.object({
  slug: z.string().trim().min(1),
});

export const insightsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/insights",
    {
      schema: {
        tags: ["Insights"],
        summary: "List legal insights and guides",
        description:
          "Paginated publication list with category, author, and free-text search.",
        querystring: insightListQuerySchema,
      },
    },
    async (request) => {
      const { rows, total } = listInsights(request.server.db, request.query);

      return {
        data: rows,
        meta: buildPageMeta(request.query, total),
      };
    },
  );

  app.get(
    "/insights/categories",
    {
      schema: {
        tags: ["Insights"],
        summary: "List insight categories",
      },
    },
    async (request) => ({
      data: listInsightCategories(request.server.db),
    }),
  );

  app.get(
    "/insights/:slug",
    {
      schema: {
        tags: ["Insights"],
        summary: "Get an insight by slug or id",
        params: insightParamsSchema,
      },
    },
    async (request) => {
      const insight = getInsightBySlugOrId(
        request.server.db,
        request.params.slug,
      );

      if (!insight) {
        throw notFound(`Insight '${request.params.slug}' was not found.`);
      }

      return { data: insight };
    },
  );
};
