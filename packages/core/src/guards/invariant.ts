export const invariant: (
  condition: unknown,
  message?: string,
) => asserts condition = (condition, message = "Invariant failed") => {
  if (!condition) {
    throw new Error(message);
  }
};
