import { AppError } from "./app-error.js";

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";
  readonly httpStatus = 404;
}

export class ConflictError extends AppError {
  readonly code = "CONFLICT";
  readonly httpStatus = 409;
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION";
  readonly httpStatus = 400;
}

export class ForbiddenError extends AppError {
  readonly code = "FORBIDDEN";
  readonly httpStatus = 403;
}

export class UnauthorizedError extends AppError {
  readonly code = "UNAUTHORIZED";
  readonly httpStatus = 401;
}

export class RateLimitError extends AppError {
  readonly code = "RATE_LIMIT";
  readonly httpStatus = 429;
}
