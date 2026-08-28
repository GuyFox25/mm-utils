export interface AppErrorOptions {
  cause?: unknown;
  details?: unknown;
}

// Global-registry brand so isAppError survives duplicate @kit/core copies, where
// `instanceof` would fail and silently downgrade a real AppError to a generic 500.
const APP_ERROR = Symbol.for("@kit/core/app-error");

export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  // `declare` keeps the property absent when no details are passed, so `'details' in err` holds.
  declare readonly details?: unknown;

  constructor(message: string, options?: AppErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    Object.defineProperty(this, APP_ERROR, { value: true });
    this.name = new.target.name;
    if (options?.details !== undefined) {
      this.details = options.details;
    }
  }
}

export const isAppError = (value: unknown): value is AppError =>
  typeof value === "object" &&
  value !== null &&
  (value as Record<symbol, unknown>)[APP_ERROR] === true;
