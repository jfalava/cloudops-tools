import { describe, expect, test } from "bun:test";

import { parseCsvValues, parseServicesOption } from "../../../src/lib/option-validation";

describe("option-validation", () => {
  describe("parseCsvValues", () => {
    test("parses comma-separated values", () => {
      const result = parseCsvValues("--region", "us-east-1, us-west-2", "example");
      expect(result).toEqual({
        ok: true,
        values: ["us-east-1", "us-west-2"],
      });
    });

    test("rejects empty entries", () => {
      const result = parseCsvValues("--region", "us-east-1,,us-west-2", "example");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(
          'Invalid value for --region: "us-east-1,,us-west-2"',
        );
        expect(result.error.message).toContain("Empty entries are not allowed");
      }
    });
  });

  describe("parseServicesOption", () => {
    const examples = {
      list: "cloudops-tools --services EC2,RDS,S3",
      all: "cloudops-tools --services all",
    } as const;

    test("accepts valid service names", () => {
      const result = parseServicesOption("EC2,RDS,S3", examples);
      expect(result).toEqual({
        ok: true,
        values: ["EC2", "RDS", "S3"],
      });
    });

    test("treats all as no filter", () => {
      const result = parseServicesOption("all", examples);
      expect(result).toEqual({
        ok: true,
        values: undefined,
      });
    });

    test("rejects all combined with specific services", () => {
      const result = parseServicesOption("all,EC2", examples);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("'all' cannot be combined");
      }
    });

    test("rejects unknown service names", () => {
      const result = parseServicesOption("EC2,NotAService", examples);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("unknown service name(s): NotAService");
      }
    });
  });
});
