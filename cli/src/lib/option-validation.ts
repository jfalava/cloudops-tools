import { ALL_GLOBAL_SERVICES, ALL_REGIONAL_SERVICES } from "@cloudops-tools/sdk";

import { invalidUserInput } from "@/lib/user-input-error";

export type ParseOptionResult<T> =
  | { readonly ok: true; readonly values: T }
  | { readonly ok: false; readonly error: Error };

export const parseCsvValues = (
  optionName: string,
  raw: string,
  example: string,
): ParseOptionResult<string[]> => {
  const values = raw.split(",").map((value) => value.trim());
  if (values.length === 0 || values.some((value) => value.length === 0)) {
    return {
      ok: false,
      error: invalidUserInput(
        `Invalid value for ${optionName}: "${raw}". Empty entries are not allowed in comma-separated lists.`,
        { example },
      ),
    };
  }
  return { ok: true, values };
};

const ALL_SERVICE_NAMES = [...ALL_REGIONAL_SERVICES, ...ALL_GLOBAL_SERVICES] as const;
const VALID_SERVICE_BY_UPPER = new Map(
  ALL_SERVICE_NAMES.map((service) => [service.toUpperCase(), service] as const),
);

export const parseServicesOption = (
  raw: string,
  examples: { readonly list: string; readonly all: string },
): ParseOptionResult<string[] | undefined> => {
  const parsed = parseCsvValues("--services", raw, examples.list);
  if (!parsed.ok) {
    return parsed;
  }

  const values = parsed.values;
  const allSelections = values.filter((value) => value.toLowerCase() === "all");
  if (allSelections.length > 0 && values.length > 1) {
    return {
      ok: false,
      error: invalidUserInput(
        "Invalid value for --services: 'all' cannot be combined with other services.",
        {
          example: examples.all,
        },
      ),
    };
  }

  if (allSelections.length > 0) {
    return { ok: true, values: undefined };
  }

  const unknown = values.filter((value) => !VALID_SERVICE_BY_UPPER.has(value.toUpperCase()));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: invalidUserInput(
        `Invalid value for --services: unknown service name(s): ${unknown.join(", ")}.`,
        {
          hint: `Valid examples include: ${ALL_SERVICE_NAMES.slice(0, 8).join(", ")}, ...`,
          example: examples.list,
        },
      ),
    };
  }

  return { ok: true, values };
};
