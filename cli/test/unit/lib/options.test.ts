import { describe, expect, test } from "bun:test";

describe("options", () => {
  describe("exports", () => {
    const expectedExports = [
      "account",
      "region",
      "initRegions",
      "exportFormat",
      "limitRegions",
      "debugOption",
      "describeOption",
      "skipGlobalOption",
      "onlyGlobalOption",
      "modeOption",
      "servicesOption",
    ] as const;

    test("exports all expected options", async () => {
      const options = await import("../../../src/options");
      for (const key of expectedExports) {
        expect(options[key]).toBeDefined();
      }
    });
  });
});
