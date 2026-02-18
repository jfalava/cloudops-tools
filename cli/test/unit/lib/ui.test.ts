import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { spawnSync } from "bun";

const cliRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

describe("ui", () => {
  let originalForceColor: string | undefined;
  let originalNoColor: string | undefined;

  beforeEach(() => {
    originalForceColor = process.env.FORCE_COLOR;
    originalNoColor = process.env.NO_COLOR;
  });

  afterEach(() => {
    if (originalForceColor !== undefined) {
      process.env.FORCE_COLOR = originalForceColor;
    } else {
      delete process.env.FORCE_COLOR;
    }
    if (originalNoColor !== undefined) {
      process.env.NO_COLOR = originalNoColor;
    } else {
      delete process.env.NO_COLOR;
    }
  });

  describe("exports", () => {
    test("exports ui object with all methods", async () => {
      const { ui } = await import("../../../src/ui");
      expect(ui.info).toBeDefined();
      expect(ui.warn).toBeDefined();
      expect(ui.error).toBeDefined();
      expect(ui.success).toBeDefined();
      expect(ui.dim).toBeDefined();
      expect(ui.bold).toBeDefined();
      expect(ui.plain).toBeDefined();
    });

    test("all methods are functions", async () => {
      const { ui } = await import("../../../src/ui");
      expect(typeof ui.info).toBe("function");
      expect(typeof ui.warn).toBe("function");
      expect(typeof ui.error).toBe("function");
      expect(typeof ui.success).toBe("function");
      expect(typeof ui.dim).toBe("function");
      expect(typeof ui.bold).toBe("function");
      expect(typeof ui.plain).toBe("function");
    });
  });

  describe("info", () => {
    test("returns a string", async () => {
      const { ui } = await import("../../../src/ui");
      const result = ui.info("test message");
      expect(typeof result).toBe("string");
      expect(result).toContain("test message");
    });
  });

  describe("warn", () => {
    test("returns a string", async () => {
      const { ui } = await import("../../../src/ui");
      const result = ui.warn("warning");
      expect(typeof result).toBe("string");
      expect(result).toContain("warning");
    });
  });

  describe("error", () => {
    test("returns a string", async () => {
      const { ui } = await import("../../../src/ui");
      const result = ui.error("error");
      expect(typeof result).toBe("string");
      expect(result).toContain("error");
    });
  });

  describe("success", () => {
    test("returns a string", async () => {
      const { ui } = await import("../../../src/ui");
      const result = ui.success("success");
      expect(typeof result).toBe("string");
      expect(result).toContain("success");
    });
  });

  describe("dim", () => {
    test("returns a string", async () => {
      const { ui } = await import("../../../src/ui");
      const result = ui.dim("dimmed");
      expect(typeof result).toBe("string");
      expect(result).toContain("dimmed");
    });
  });

  describe("bold", () => {
    test("returns a string", async () => {
      const { ui } = await import("../../../src/ui");
      const result = ui.bold("bold");
      expect(typeof result).toBe("string");
      expect(result).toContain("bold");
    });
  });

  describe("plain", () => {
    test("always returns the exact text", async () => {
      const { ui } = await import("../../../src/ui");
      const result = ui.plain("plain text");
      expect(result).toBe("plain text");
    });

    test("returns empty string for empty input", async () => {
      const { ui } = await import("../../../src/ui");
      expect(ui.plain("")).toBe("");
    });
  });

  describe("color environment handling", () => {
    test("NO_COLOR disables colors at import time", () => {
      const noColorEnv = { ...process.env, NO_COLOR: "1" };

      const result = spawnSync({
        cmd: [
          "bun",
          "-e",
          'delete process.env.FORCE_COLOR; const { ui } = await import("./src/ui"); process.stdout.write(ui.info("test"));',
        ],
        cwd: cliRoot,
        env: noColorEnv,
      });

      expect(result.exitCode).toBe(0);
      expect(new TextDecoder().decode(result.stdout)).toBe("test");
    });
  });
});
