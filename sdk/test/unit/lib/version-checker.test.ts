import { describe, expect, test } from "bun:test";

import {
  getEKSVersionStatus,
  getElastiCacheVersionStatus,
  getLambdaRuntimeStatus,
  getRDSEngineVersionStatus,
} from "../../../src/lib/version-checker";

describe("getEKSVersionStatus", () => {
  const testCases: Array<{
    version: string | undefined;
    expected: "Current" | "Deprecated" | "Extended Support" | "Unknown";
  }> = [
    { version: "1.35", expected: "Current" },
    { version: "1.34", expected: "Current" },
    { version: "1.31", expected: "Extended Support" },
    { version: "1.30", expected: "Extended Support" },
    { version: "1.29", expected: "Extended Support" },
    { version: "1.24", expected: "Unknown" },
    { version: "1.29.3", expected: "Extended Support" },
    { version: "1.28.5", expected: "Unknown" },
    { version: undefined, expected: "Unknown" },
    { version: "", expected: "Unknown" },
    { version: "invalid", expected: "Unknown" },
  ];

  for (const { version, expected } of testCases) {
    test(`version "${version}" → ${expected}`, () => {
      expect(getEKSVersionStatus(version)).toBe(expected);
    });
  }
});

describe("getLambdaRuntimeStatus", () => {
  const testCases: Array<{
    runtime: string | undefined;
    expected: "Current" | "Deprecated" | "End of Life" | "Unknown";
  }> = [
    // Current runtimes
    { runtime: "nodejs20.x", expected: "Current" },
    { runtime: "nodejs24.x", expected: "Current" },
    { runtime: "python3.12", expected: "Current" },
    { runtime: "python3.14", expected: "Current" },
    { runtime: "java21", expected: "Current" },
    { runtime: "java8.al2", expected: "Current" },
    { runtime: "dotnet8", expected: "Current" },
    { runtime: "ruby3.3", expected: "Current" },
    { runtime: "provided.al2023", expected: "Current" },
    // Deprecated runtimes
    { runtime: "nodejs18.x", expected: "Deprecated" },
    { runtime: "nodejs16.x", expected: "Deprecated" },
    { runtime: "python3.9", expected: "Deprecated" },
    { runtime: "go1.x", expected: "Deprecated" },
    { runtime: "dotnet6", expected: "Deprecated" },
    { runtime: "ruby2.7", expected: "Deprecated" },
    // End of Life runtimes
    { runtime: "nodejs12.x", expected: "End of Life" },
    { runtime: "python2.7", expected: "End of Life" },
    { runtime: "python3.6", expected: "End of Life" },
    { runtime: "dotnetcore3.1", expected: "End of Life" },
    // Unknown cases
    { runtime: undefined, expected: "Unknown" },
    { runtime: "", expected: "Unknown" },
    { runtime: "custom-runtime", expected: "Unknown" },
  ];

  for (const { runtime, expected } of testCases) {
    test(`runtime "${runtime}" → ${expected}`, () => {
      expect(getLambdaRuntimeStatus(runtime)).toBe(expected);
    });
  }
});

describe("getRDSEngineVersionStatus", () => {
  const testCases: Array<{
    engine: string | undefined;
    version: string | undefined;
    expected: "Current" | "Deprecated" | "Unknown";
  }> = [
    // PostgreSQL
    { engine: "postgres", version: "14", expected: "Current" },
    { engine: "postgres", version: "15", expected: "Current" },
    { engine: "postgres", version: "9.6", expected: "Deprecated" },
    { engine: "postgres", version: "11", expected: "Deprecated" },
    // MySQL
    { engine: "mysql", version: "8.0", expected: "Current" },
    { engine: "mysql", version: "8.1", expected: "Current" },
    { engine: "mysql", version: "5.7", expected: "Deprecated" },
    // MariaDB
    { engine: "mariadb", version: "10.4", expected: "Current" },
    { engine: "mariadb", version: "10.6", expected: "Current" },
    { engine: "mariadb", version: "10.3", expected: "Deprecated" },
    // Aurora MySQL
    { engine: "aurora-mysql", version: "3", expected: "Current" },
    { engine: "aurora-mysql", version: "2", expected: "Current" },
    { engine: "aurora-mysql", version: "1", expected: "Deprecated" },
    // Aurora PostgreSQL
    { engine: "aurora-postgresql", version: "13", expected: "Current" },
    { engine: "aurora-postgresql", version: "11", expected: "Current" },
    { engine: "aurora-postgresql", version: "10", expected: "Deprecated" },
    // Engine normalization (underscore to hyphen)
    { engine: "aurora_postgresql", version: "13", expected: "Current" },
    { engine: "aurora_mysql", version: "3", expected: "Current" },
    // Unknown cases
    { engine: undefined, version: "14", expected: "Unknown" },
    { engine: "postgres", version: undefined, expected: "Unknown" },
    { engine: "unknown-engine", version: "1.0", expected: "Unknown" },
    { engine: "postgres", version: "", expected: "Unknown" },
  ];

  for (const { engine, version, expected } of testCases) {
    test(`engine "${engine}" version "${version}" → ${expected}`, () => {
      expect(getRDSEngineVersionStatus(engine, version)).toBe(expected);
    });
  }
});

describe("getElastiCacheVersionStatus", () => {
  const testCases: Array<{
    engine: string | undefined;
    version: string | undefined;
    expected: "Current" | "Deprecated" | "Unknown";
  }> = [
    // Redis
    { engine: "redis", version: "7", expected: "Current" },
    { engine: "redis", version: "7.1", expected: "Current" },
    { engine: "redis", version: "6", expected: "Current" },
    { engine: "redis", version: "6.2", expected: "Current" },
    { engine: "redis", version: "5", expected: "Deprecated" },
    { engine: "redis", version: "5.0", expected: "Deprecated" },
    { engine: "redis", version: "4.0", expected: "Deprecated" },
    // Memcached
    { engine: "memcached", version: "1.6", expected: "Current" },
    { engine: "memcached", version: "1.6.12", expected: "Current" },
    { engine: "memcached", version: "1.5", expected: "Deprecated" },
    { engine: "memcached", version: "1.4", expected: "Deprecated" },
    // Unknown cases
    { engine: undefined, version: "7", expected: "Unknown" },
    { engine: "redis", version: undefined, expected: "Unknown" },
    { engine: "unknown-engine", version: "1.0", expected: "Unknown" },
    { engine: "redis", version: "", expected: "Unknown" },
  ];

  for (const { engine, version, expected } of testCases) {
    test(`engine "${engine}" version "${version}" → ${expected}`, () => {
      expect(getElastiCacheVersionStatus(engine, version)).toBe(expected);
    });
  }
});

describe("version comparison edge cases", () => {
  test("handles version with multiple parts", () => {
    expect(getRDSEngineVersionStatus("postgres", "14.5.1")).toBe("Current");
    expect(getRDSEngineVersionStatus("postgres", "11.2.3")).toBe("Deprecated");
  });

  test("handles single digit comparison correctly", () => {
    // "10" should be greater than "9" (numeric comparison)
    // But both are below postgres currentMin of "12", so both are Deprecated
    expect(getRDSEngineVersionStatus("postgres", "10")).toBe("Deprecated");
    expect(getRDSEngineVersionStatus("postgres", "9")).toBe("Deprecated");
    // Version 12 and above are Current
    expect(getRDSEngineVersionStatus("postgres", "12")).toBe("Current");
    expect(getRDSEngineVersionStatus("postgres", "13")).toBe("Current");
  });

  test("handles version suffixes", () => {
    expect(getEKSVersionStatus("1.29-eks-1")).toBe("Extended Support");
    expect(getEKSVersionStatus("1.28-eks-1")).toBe("Unknown");
  });
});
