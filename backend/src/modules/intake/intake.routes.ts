import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { notFound } from "../../shared/http/errors.js";
import {
  intakeBodySchema,
  intakeParamsSchema,
  nextStepFor,
} from "./intake.schema.js";
import {
  createIntakeRequest,
  getIntakeByReference,
} from "./intake.service.js";

export const intakeRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/intake",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
      schema: {
        tags: ["Intake"],
        summary: "Submit a legal intake request",
        description:
          "Creates a legal-assessment, conflict-check, or consultation request. The endpoint records the acknowledgement that this is not legal advice and does not create an advocate-client relationship.",
        body: intakeBodySchema,
      },
    },
    async (request, reply) => {
      const intake = createIntakeRequest(request.server.db, request.body);

      return reply.status(201).send({
        data: {
          reference: intake.reference,
          kind: intake.kind,
          status: intake.status,
          receivedAt: intake.createdAt,
          trackingUrl: `/api/v1/intake/${intake.reference}`,
          nextStep: nextStepFor(intake.kind),
        },
      });
    },
  );

  app.get(
    "/intake/:reference",
    {
      schema: {
        tags: ["Intake"],
        summary: "Track an intake request",
        description:
          "Returns limited, non-sensitive status fields for an intake reference. Personal details are never returned by this endpoint.",
        params: intakeParamsSchema,
      },
    },
    async (request) => {
      const intake = getIntakeByReference(
        request.server.db,
        request.params.reference,
      );

      if (!intake) {
        throw notFound("No intake request was found for that reference.");
      }

      return { data: intake };
    },
  );
};
