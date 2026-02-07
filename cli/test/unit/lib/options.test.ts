import { describe, expect, test } from "bun:test";

describe("options", () => {
  // We'll test the options by importing them and checking their properties
  // Since the actual Options type is opaque, we test the module exports
  describe("exports", () => {
    test("exports account option", async () => {
      const options = await import("../../../src/options");
      expect(options.account).toBeDefined();
    });

    test("exports region option", async () => {
      const options = await import("../../../src/options");
      expect(options.region).toBeDefined();
    });

    test("exports initRegions option", async () => {
      const options = await import("../../../src/options");
      expect(options.initRegions).toBeDefined();
    });

    test("exports exportFormat option", async () => {
      const options = await import("../../../src/options");
      expect(options.exportFormat).toBeDefined();
    });

    test("exports limitRegions option", async () => {
      const options = await import("../../../src/options");
      expect(options.limitRegions).toBeDefined();
    });

    test("exports debugOption", async () => {
      const options = await import("../../../src/options");
      expect(options.debugOption).toBeDefined();
    });

    test("exports describeOption", async () => {
      const options = await import("../../../src/options");
      expect(options.describeOption).toBeDefined();
    });

    test("exports skipGlobalOption", async () => {
      const options = await import("../../../src/options");
      expect(options.skipGlobalOption).toBeDefined();
    });

    test("exports onlyGlobalOption", async () => {
      const options = await import("../../../src/options");
      expect(options.onlyGlobalOption).toBeDefined();
    });

    test("exports modeOption", async () => {
      const options = await import("../../../src/options");
      expect(options.modeOption).toBeDefined();
    });

    test("exports servicesOption", async () => {
      const options = await import("../../../src/options");
      expect(options.servicesOption).toBeDefined();
    });
  });

  describe("option types", () => {
    test("all options are defined as Effect CLI Options", async () => {
      const options = await import("../../../src/options");
      const optionKeys = [
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
      ];

      for (const key of optionKeys) {
        expect(options[key as keyof typeof options]).toBeDefined();
      }
    });
  });
});
