const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+-]*$/;

const normalizeQuotedValue = (value: string): string => {
  let current = value.trim();

  for (let index = 0; index < 4; index += 1) {
    const unescapedQuotes = current.replace(/\\(['"])/g, "$1").trim();
    const unwrappedQuotes = unescapedQuotes.replace(/^['"]+|['"]+$/g, "").trim();
    if (unwrappedQuotes === current) {
      return current;
    }
    current = unwrappedQuotes;
  }

  return current;
};

const normalizeBuildVersion = (value: string | undefined): string | undefined => {
  if (typeof value === "undefined") {
    return undefined;
  }

  const cleaned = normalizeQuotedValue(value);
  if (cleaned.length === 0) {
    return undefined;
  }

  return VERSION_PATTERN.test(cleaned) ? cleaned : undefined;
};

export const resolveCliVersion = (
  buildVersion: string | undefined,
  packageVersion: string,
): string => normalizeBuildVersion(buildVersion) ?? packageVersion;
