const normalizeBuildVersion = (value: string | undefined): string | undefined => {
  if (typeof value === "undefined") {
    return undefined;
  }
  const cleaned = value.trim().replace(/^['"]+|['"]+$/g, "");
  return cleaned.length > 0 ? cleaned : undefined;
};

export const resolveCliVersion = (
  buildVersion: string | undefined,
  packageVersion: string,
): string => normalizeBuildVersion(buildVersion) ?? packageVersion;

