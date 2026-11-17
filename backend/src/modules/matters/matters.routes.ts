import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { notFound } from "../../shared/http/errors.js";
import {
  buildPageMeta,
  paginationQuerySchema,
} from "../../shared/http/pagination.js";
import {
  getMatterBySlugOrId,
  listMatterCategories,
  listMatters,
} from "./matters.service.js";

const matterListQuerySchema = paginationQuerySchema.extend({
  category: z.string().trim().min(1).optional(),
  practice: z.string().trim().min(1).optional(),
  year: z.string().trim().min(4).max(4).optional(),
  q: z.string().trim().min(1).max(120).optional(),
});

const matterParamsSchema = z.object({
  slug: z.string().trim().min(1),
});

export const mattersRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/matters",
    {
      schema: {
        tags: ["Matters"],
        summary: "List representative matters",
        description:
          "Paginated public matter ledger with category, practice, year, and free-text filters.",
        querystring: matterListQuerySchema,
      },
    },
    async (request) => {
      const { rows, total } = listMatters(request.server.db, request.query);

      return {
        data: rows,
        meta: buildPageMeta(request.query, total),
      };
    },
  );

  app.get(
    "/matters/categories",
    {
      schema: {
        tags: ["Matters"],
        summary: "List matter categories",
      },
    },
    async (request) => ({
      data: listMatterCategories(request.server.db),
    }),
  );

  app.get(
    "/matters/:slug",
    {
      schema: {
        tags: ["Matters"],
        summary: "Get a representative matter by slug or id",
        params: matterParamsSchema,
      },
    },
    async (request) => {
      const matter = getMatterBySlugOrId(request.server.db, request.params.slug);

      if (!matter) {
        throw notFound(`Matter '${request.params.slug}' was not found.`);
      }

      return { data: matter };
    },
  );
};
