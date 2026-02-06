export function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeArray(value: unknown): unknown[] {
  if (value == null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }

    return undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "0") {
    return false;
  }

  return undefined;
}

export function asDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function getTagKey(tag: Record<string, unknown>): string | undefined {
  return asString(tag.Key) ?? asString(tag.key);
}

function getTagValue(tag: Record<string, unknown>): string | undefined {
  if ("Value" in tag) {
    return asString(tag.Value);
  }

  return asString(tag.value);
}

export function tagListToRecord(tags: unknown): Record<string, string> {
  const result: Record<string, string> = {};

  for (const tag of normalizeArray(tags)) {
    if (!isObjectRecord(tag)) {
      continue;
    }

    const key = getTagKey(tag);
    const value = getTagValue(tag);

    if (!key || value === undefined) {
      continue;
    }

    result[key] = value;
  }

  return result;
}

export function getNameTag(tags: unknown): string | undefined {
  return tagListToRecord(tags).Name;
}
