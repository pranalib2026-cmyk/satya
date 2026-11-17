import type { FastifyError, FastifyInstance } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { ZodError } from "zod";
import { AppError } from "./errors.js";

function formatZodIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: "not_found",
        message: `Route ${request.method} ${request.url} does not exist.`,
      },
      requestId: request.id,
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
        requestId: request.id,
      });
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        error: {
          code: "validation_error",
          message: "Request validation failed.",
          details: error.validation.map((issue) => ({
            path: issue.instancePath.replace(/^\//, "").replaceAll("/", ".") || "(root)",
            message: issue.message ?? "Invalid value",
          })),
        },
        requestId: request.id,
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "validation_error",
          message: "Request validation failed.",
          details: formatZodIssues(error),
        },
        requestId: request.id,
      });
    }

    const fastifyError = error as FastifyError;
    if (fastifyError.statusCode !== undefined && fastifyError.statusCode < 500) {
      return reply.status(fastifyError.statusCode).send({
        error: {
          code: fastifyError.code ?? "request_error",
          message: fastifyError.message,
        },
        requestId: request.id,
      });
    }

    request.log.error({ err: error }, "Unhandled request error");

    return reply.status(500).send({
      error: {
        code: "internal_error",
        message: "An unexpected error occurred. Please try again later.",
      },
      requestId: request.id,
    });
  });
}
