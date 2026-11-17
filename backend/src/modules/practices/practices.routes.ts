import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { notFound } from "../../shared/http/errors.js";
import { getPracticeBySlugOrId, listPractices } from "./practices.service.js";

const practiceParamsSchema = z.object({
  slug: z.string().trim().min(1),
});

export const practicesRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/practices",
    {
      schema: {
        tags: ["Practices"],
        summary: "List practice areas",
        description:
          "Returns all public practice areas with fee bands, scope lists, forums, and representative results.",
      },
    },
    async (request) => ({
      data: listPractices(request.server.db),
    }),
  );

  app.get(
    "/practices/:slug",
    {
      schema: {
        tags: ["Practices"],
        summary: "Get a practice area by slug or id",
        params: practiceParamsSchema,
      },
    },
    async (request) => {
      const practice = getPracticeBySlugOrId(
        request.server.db,
        request.params.slug,
      );

      if (!practice) {
        throw notFound(`Practice area '${request.params.slug}' was not found.`);
      }

      return { data: practice };
    },
  );
};
