import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { notFound } from "../../shared/http/errors.js";
import {
  buildPageMeta,
  paginationQuerySchema,
} from "../../shared/http/pagination.js";
import { getAdvocateById, listAdvocates } from "./advocates.service.js";

const advocateListQuerySchema = paginationQuerySchema.extend({
  practice: z.string().trim().min(1).optional(),
  language: z.string().trim().min(1).optional(),
  partner: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  q: z.string().trim().min(1).max(120).optional(),
});

const advocateParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const advocatesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/advocates",
    {
      schema: {
        tags: ["Advocates"],
        summary: "List verified advocates",
        description:
          "Paginated advocate directory with filters for practice, language, partner status, and free-text search.",
        querystring: advocateListQuerySchema,
      },
    },
    async (request) => {
      const { rows, total } = listAdvocates(request.server.db, request.query);

      return {
        data: rows,
        meta: buildPageMeta(request.query, total),
      };
    },
  );

  app.get(
    "/advocates/:id",
    {
      schema: {
        tags: ["Advocates"],
        summary: "Get an advocate by id",
        params: advocateParamsSchema,
      },
    },
    async (request) => {
      const advocate = getAdvocateById(request.server.db, request.params.id);

      if (!advocate) {
        throw notFound(`Advocate '${request.params.id}' was not found.`);
      }

      return { data: advocate };
    },
  );
};
