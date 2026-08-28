export const assertNever = (value: never, message?: string): never => {
  throw new Error(message ?? `Unexpected value: ${String(value)}`);
};
