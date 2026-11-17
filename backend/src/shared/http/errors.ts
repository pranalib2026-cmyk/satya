export type ErrorDetails = Record<string, unknown> | unknown[] | undefined;

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ErrorDetails;

  constructor(
    message: string,
    statusCode = 500,
    code = "internal_error",
    details?: ErrorDetails,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function notFound(message = "Resource not found"): AppError {
  return new AppError(message, 404, "not_found");
}

export function badRequest(
  message = "Invalid request",
  details?: ErrorDetails,
): AppError {
  return new AppError(message, 400, "bad_request", details);
}

export function conflict(
  message = "Request conflicts with existing state",
  details?: ErrorDetails,
): AppError {
  return new AppError(message, 409, "conflict", details);
}
