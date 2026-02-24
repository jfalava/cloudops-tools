export class CliUserInputError extends Error {
  readonly _tag = "CliUserInputError";
  readonly example?: string;
  readonly hint?: string;

  constructor(message: string, options?: { readonly example?: string; readonly hint?: string }) {
    super(message);
    this.name = "CliUserInputError";
    this.example = options?.example;
    this.hint = options?.hint;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const invalidUserInput = (
  message: string,
  options?: { readonly example?: string; readonly hint?: string },
): CliUserInputError => new CliUserInputError(message, options);

export const isCliUserInputError = (value: unknown): value is CliUserInputError =>
  value instanceof CliUserInputError ||
  (typeof value === "object" &&
    value !== null &&
    "_tag" in value &&
    value._tag === "CliUserInputError" &&
    "message" in value &&
    typeof value.message === "string");

export const formatCliUserInputError = (error: CliUserInputError): string => {
  const lines = [error.message];
  if (error.hint) {
    lines.push(`Hint: ${error.hint}`);
  }
  if (error.example) {
    lines.push(`Example: ${error.example}`);
  }
  return lines.join("\n");
};
