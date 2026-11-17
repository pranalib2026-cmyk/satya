import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  getCatalog,
  listFaqs,
  listFixedFees,
  listTestimonials,
} from "./catalog.service.js";

export const catalogRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/catalog",
    {
      schema: {
        tags: ["Catalog"],
        summary: "Get FAQs, testimonials and fixed-fee packages",
        description:
          "Convenience endpoint for the home page. Prefer the individual endpoints when only one collection is needed.",
      },
    },
    async (request) => ({ data: getCatalog(request.server.db) }),
  );

  app.get(
    "/faqs",
    {
      schema: {
        tags: ["Catalog"],
        summary: "List frequently asked questions",
      },
    },
    async (request) => ({ data: listFaqs(request.server.db) }),
  );

  app.get(
    "/testimonials",
    {
      schema: {
        tags: ["Catalog"],
        summary: "List client testimonials",
      },
    },
    async (request) => ({ data: listTestimonials(request.server.db) }),
  );

  app.get(
    "/fixed-fees",
    {
      schema: {
        tags: ["Catalog"],
        summary: "List fixed-fee packages",
        description:
          "Content debt note: the currently seeded packages still reflect USD/legacy firm copy and must be replaced before production.",
      },
    },
    async (request) => ({ data: listFixedFees(request.server.db) }),
  );
};
