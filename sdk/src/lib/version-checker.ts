export type VersionStatus =
  | "Current"
  | "Deprecated"
  | "Extended Support"
  | "End of Life"
  | "Unknown";

type VersionPolicy = {
  current?: string[];
  deprecated?: string[];
  extendedSupport?: string[];
  endOfLife?: string[];
  currentMin?: string;
  deprecatedMin?: string;
};

type EnginePolicyMap = Record<string, VersionPolicy>;

type VersionPolicyOverrides = {
  eks?: VersionPolicy;
  lambda?: VersionPolicy;
  rds?: EnginePolicyMap;
  elasticache?: EnginePolicyMap;
};

const DEFAULT_POLICY: VersionPolicyOverrides = {
  // Update this policy as AWS lifecycle changes.
  // Versions are matched by exact value or prefix (use '*' for prefix match).
  eks: {
    current: ["1.32", "1.33", "1.34", "1.35"],
    extendedSupport: ["1.29", "1.30", "1.31"],
  },
  lambda: {
    current: [
      "nodejs20.x",
      "nodejs22.x",
      "nodejs24.x",
      "python3.10",
      "python3.11",
      "python3.12",
      "python3.13",
      "python3.14",
      "java8.al2",
      "java11",
      "java17",
      "java21",
      "java25",
      "dotnet8",
      "dotnet10",
      "ruby3.2",
      "ruby3.3",
      "ruby3.4",
      "provided.al2",
      "provided.al2023",
    ],
    deprecated: [
      "nodejs18.x",
      "nodejs14.x",
      "nodejs16.x",
      "python3.8",
      "python3.9",
      "java8",
      "go1.x",
      "provided",
      "dotnet6",
      "ruby2.7",
    ],
    endOfLife: [
      "nodejs10.x",
      "nodejs12.x",
      "python2.7",
      "python3.6",
      "python3.7",
      "dotnetcore3.1",
      "ruby2.5",
    ],
  },
  rds: {
    postgres: { currentMin: "12" },
    mysql: { currentMin: "8.0" },
    mariadb: { currentMin: "10.4" },
    "aurora-mysql": { currentMin: "2" },
    "aurora-postgresql": { currentMin: "11" },
    "oracle-se2": { currentMin: "19" },
    "sqlserver-se": { currentMin: "14" },
    "sqlserver-ee": { currentMin: "14" },
    "sqlserver-ex": { currentMin: "14" },
    "sqlserver-web": { currentMin: "14" },
  },
  elasticache: {
    redis: { currentMin: "6" },
    memcached: { currentMin: "1.6" },
  },
};

import * as fs from "fs";

import { asString, isObjectRecord } from "./aws-payload";

const ENV_POLICY_PATH = "CLOUDOPS_VERSION_POLICY_PATH";

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const parsed = value.filter((entry): entry is string => typeof entry === "string");
  return parsed.length === value.length ? parsed : undefined;
}

function parseVersionPolicy(value: unknown): VersionPolicy | undefined {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  return {
    current: parseStringArray(value.current),
    deprecated: parseStringArray(value.deprecated),
    extendedSupport: parseStringArray(value.extendedSupport),
    endOfLife: parseStringArray(value.endOfLife),
    currentMin: asString(value.currentMin),
    deprecatedMin: asString(value.deprecatedMin),
  };
}

function parseEnginePolicyMap(value: unknown): EnginePolicyMap | undefined {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  const policyMap: EnginePolicyMap = {};
  for (const [engine, policy] of Object.entries(value)) {
    const parsedPolicy = parseVersionPolicy(policy);
    if (parsedPolicy) {
      policyMap[engine] = parsedPolicy;
    }
  }

  return policyMap;
}

function parsePolicyOverrides(value: unknown): VersionPolicyOverrides | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  return {
    eks: parseVersionPolicy(value.eks),
    lambda: parseVersionPolicy(value.lambda),
    rds: parseEnginePolicyMap(value.rds),
    elasticache: parseEnginePolicyMap(value.elasticache),
  };
}

function readPolicyOverrides(): VersionPolicyOverrides | null {
  const path = process.env[ENV_POLICY_PATH];
  if (!path) {
    return null;
  }

  try {
    const content = fs.readFileSync(path, "utf-8");
    if (!content) {
      return null;
    }
    const parsed: unknown = JSON.parse(content);
    return parsePolicyOverrides(parsed);
  } catch {
    return null;
  }
}

const POLICY_OVERRIDES = readPolicyOverrides();

function getPolicy(): VersionPolicyOverrides {
  if (!POLICY_OVERRIDES) {
    return DEFAULT_POLICY;
  }
  return {
    eks: POLICY_OVERRIDES.eks ?? DEFAULT_POLICY.eks,
    lambda: POLICY_OVERRIDES.lambda ?? DEFAULT_POLICY.lambda,
    rds: POLICY_OVERRIDES.rds ?? DEFAULT_POLICY.rds,
    elasticache: POLICY_OVERRIDES.elasticache ?? DEFAULT_POLICY.elasticache,
  };
}

function normalizeVersion(version: string | undefined): string | undefined {
  if (!version) {
    return undefined;
  }
  return version.trim();
}

function normalizeEksVersion(version: string | undefined): string | undefined {
  if (!version) {
    return undefined;
  }
  const match = version.match(/^(\d+)\.(\d+)/);
  if (!match) {
    return undefined;
  }
  return `${match[1]}.${match[2]}`;
}

function extractNumericParts(version: string | undefined): number[] | undefined {
  if (!version) {
    return undefined;
  }
  const matches = version.match(/\d+/g);
  if (!matches || matches.length === 0) {
    return undefined;
  }
  return matches.map((part) => Number(part));
}

function compareNumericVersion(a: string, b: string): number {
  const aParts = extractNumericParts(a) ?? [];
  const bParts = extractNumericParts(b) ?? [];
  const maxLen = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < maxLen; i += 1) {
    const left = aParts[i] ?? 0;
    const right = bParts[i] ?? 0;
    if (left > right) {
      return 1;
    }
    if (left < right) {
      return -1;
    }
  }
  return 0;
}

function matchesList(version: string, list?: string[]): boolean {
  if (!list || list.length === 0) {
    return false;
  }
  for (const entry of list) {
    if (entry.endsWith("*")) {
      const prefix = entry.slice(0, -1);
      if (version.startsWith(prefix)) {
        return true;
      }
    } else if (entry === version) {
      return true;
    }
  }
  return false;
}

function statusFromPolicy(version: string | undefined, policy?: VersionPolicy): VersionStatus {
  if (!version || !policy) {
    return "Unknown";
  }

  if (matchesList(version, policy.endOfLife)) {
    return "End of Life";
  }
  if (matchesList(version, policy.extendedSupport)) {
    return "Extended Support";
  }
  if (matchesList(version, policy.deprecated)) {
    return "Deprecated";
  }
  if (matchesList(version, policy.current)) {
    return "Current";
  }

  if (policy.currentMin) {
    return compareNumericVersion(version, policy.currentMin) >= 0 ? "Current" : "Deprecated";
  }

  if (policy.deprecatedMin) {
    return compareNumericVersion(version, policy.deprecatedMin) >= 0 ? "Deprecated" : "End of Life";
  }

  return "Unknown";
}

function getEnginePolicy(engine: string | undefined, policyMap?: EnginePolicyMap): VersionPolicy {
  if (!engine || !policyMap) {
    return {};
  }
  const normalized = engine.toLowerCase();
  return policyMap[normalized] ?? policyMap[normalized.replace(/_/g, "-")] ?? {};
}

export function getEKSVersionStatus(version: string | undefined): VersionStatus {
  const policy = getPolicy().eks;
  const normalized = normalizeEksVersion(version);
  return statusFromPolicy(normalized, policy);
}

export function getLambdaRuntimeStatus(runtime: string | undefined): VersionStatus {
  const policy = getPolicy().lambda;
  const normalized = normalizeVersion(runtime);
  return statusFromPolicy(normalized, policy);
}

export function getRDSEngineVersionStatus(
  engine: string | undefined,
  version: string | undefined,
): VersionStatus {
  const policyMap = getPolicy().rds;
  const policy = getEnginePolicy(engine, policyMap);
  const normalized = normalizeVersion(version);
  return statusFromPolicy(normalized, policy);
}

export function getElastiCacheVersionStatus(
  engine: string | undefined,
  version: string | undefined,
): VersionStatus {
  const policyMap = getPolicy().elasticache;
  const policy = getEnginePolicy(engine, policyMap);
  const normalized = normalizeVersion(version);
  return statusFromPolicy(normalized, policy);
}
