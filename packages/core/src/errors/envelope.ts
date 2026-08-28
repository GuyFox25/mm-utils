import { isAppError } from "./app-error.js";

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    httpStatus: number;
    details?: unknown;
  };
}

export const toErrorEnvelope = (value: unknown): ErrorEnvelope => {
  if (isAppError(value)) {
    return {
      error: {
        code: value.code,
        message: value.message,
        httpStatus: value.httpStatus,
        ...(value.details !== undefined ? { details: value.details } : {}),
      },
    };
  }

  return {
    error: { code: "INTERNAL", message: "Internal server error", httpStatus: 500 },
  };
};
