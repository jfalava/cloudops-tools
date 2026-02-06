import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Effect, Option } from "effect";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  type CloudOpsConfig,
  ConfigService,
  ConfigServiceLive,
  getConfigWithDefaults,
} from "../../../src/lib/config";

const runEffect = <A, E>(effect: Effect.Effect<A, E, ConfigService>): Promise<A> => {
  return Effect.runPromise(Effect.provide(effect, ConfigServiceLive));
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const parseJson = <T>(content: string): T => JSON.parse(content) as T;

describe("ConfigService", () => {
  let tempHomeDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    tempHomeDir = await mkdtemp(join(tmpdir(), "cloudops-config-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tempHomeDir;
    delete process.env.CLOUDOPS_DEFAULT_REGION;
    delete process.env.CLOUDOPS_DEFAULT_ACCOUNT;
    delete process.env.CLOUDOPS_DEFAULT_FORMAT;
    delete process.env.CLOUDOPS_DEFAULT_MODE;
    delete process.env.CLOUDOPS_DEFAULT_SERVICES;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(tempHomeDir, { recursive: true });
  });

  describe("loadConfig", () => {
    test("returns default config when file does not exist", async () => {
      const effect = Effect.gen(function* () {
        const service = yield* ConfigService;
        return yield* service.loadConfig();
      });

      const config = await runEffect(effect);
      expect(config).toEqual({});
    });

    test("returns parsed config when file exists", async () => {
      const configDir = join(tempHomeDir, ".config/cloudops-tools");
      await mkdir(configDir, { recursive: true });
      const configFile = join(configDir, "config.json");

      const testConfig: CloudOpsConfig = {
        defaultRegion: "eu-west-1",
        defaultFormat: "json",
        defaultMode: "security",
      };
      await writeFile(configFile, JSON.stringify(testConfig));

      const effect = Effect.gen(function* () {
        const service = yield* ConfigService;
        return yield* service.loadConfig();
      });

      const config = await runEffect(effect);
      expect(config.defaultRegion).toBe("eu-west-1");
      expect(config.defaultFormat).toBe("json");
      expect(config.defaultMode).toBe("security");
    });

    test("returns default config when JSON is invalid", async () => {
      const configDir = join(tempHomeDir, ".config/cloudops-tools");
      await mkdir(configDir, { recursive: true });
      const configFile = join(configDir, "config.json");

      await writeFile(configFile, "invalid json {{}");

      const effect = Effect.gen(function* () {
        const service = yield* ConfigService;
        return yield* service.loadConfig();
      });

      const config = await runEffect(effect);
      expect(config).toEqual({});
    });
  });

  describe("saveConfig", () => {
    test("creates directory if missing", async () => {
      const testConfig: CloudOpsConfig = {
        defaultRegion: "ap-southeast-1",
      };

      const effect = Effect.gen(function* () {
        const service = yield* ConfigService;
        yield* service.saveConfig(testConfig);
      });

      await runEffect(effect);

      const configFile = join(tempHomeDir, ".config/cloudops-tools/config.json");
      const content = await readFile(configFile, "utf-8");
      const saved = parseJson<CloudOpsConfig>(content);

      expect(saved.defaultRegion).toBe("ap-southeast-1");
    });

    test("writes valid JSON", async () => {
      const testConfig: CloudOpsConfig = {
        defaultRegion: "us-west-2",
        defaultAccount: "123456789012",
        defaultFormat: "all",
        defaultMode: "detailed",
      };

      const effect = Effect.gen(function* () {
        const service = yield* ConfigService;
        yield* service.saveConfig(testConfig);
      });

      await runEffect(effect);

      const configFile = join(tempHomeDir, ".config/cloudops-tools/config.json");
      const content = await readFile(configFile, "utf-8");
      const saved = parseJson<CloudOpsConfig>(content);

      expect(saved).toEqual(testConfig);
    });

    test("roundtrips with loadConfig", async () => {
      const testConfig: CloudOpsConfig = {
        defaultRegion: "eu-central-1",
        skipGlobal: true,
        onlyGlobal: false,
      };

      const effect = Effect.gen(function* () {
        const service = yield* ConfigService;
        yield* service.saveConfig(testConfig);
        return yield* service.loadConfig();
      });

      const config = await runEffect(effect);
      expect(config.defaultRegion).toBe("eu-central-1");
      expect(config.skipGlobal).toBe(true);
      expect(config.onlyGlobal).toBe(false);
    });
  });

  describe("mergeWithCLI", () => {
    test("CLI options override file config", async () => {
      const configDir = join(tempHomeDir, ".config/cloudops-tools");
      await mkdir(configDir, { recursive: true });
      const configFile = join(configDir, "config.json");

      const fileConfig: CloudOpsConfig = {
        defaultRegion: "us-east-1",
        defaultFormat: "csv",
      };
      await writeFile(configFile, JSON.stringify(fileConfig));

      const cliOptions = {
        defaultRegion: "eu-west-1",
      };

      const effect = Effect.gen(function* () {
        const service = yield* ConfigService;
        return yield* service.mergeWithCLI(cliOptions);
      });

      const merged = await runEffect(effect);
      expect(merged.defaultRegion).toBe("eu-west-1");
      expect(merged.defaultFormat).toBe("csv");
    });

    test("env vars override file config but not CLI", async () => {
      const configDir = join(tempHomeDir, ".config/cloudops-tools");
      await mkdir(configDir, { recursive: true });
      const configFile = join(configDir, "config.json");

      const fileConfig: CloudOpsConfig = {
        defaultRegion: "us-east-1",
        defaultFormat: "csv",
      };
      await writeFile(configFile, JSON.stringify(fileConfig));

      process.env.CLOUDOPS_DEFAULT_REGION = "ap-southeast-1";
      process.env.CLOUDOPS_DEFAULT_FORMAT = "json";

      const cliOptions = {
        defaultRegion: "eu-west-1",
      };

      const effect = Effect.gen(function* () {
        const service = yield* ConfigService;
        return yield* service.mergeWithCLI(cliOptions);
      });

      const merged = await runEffect(effect);
      expect(merged.defaultRegion).toBe("eu-west-1");
      expect(merged.defaultFormat).toBe("json");
    });

    test("handles all env vars", async () => {
      process.env.CLOUDOPS_DEFAULT_REGION = "us-west-2";
      process.env.CLOUDOPS_DEFAULT_ACCOUNT = "123456789012";
      process.env.CLOUDOPS_DEFAULT_FORMAT = "json";
      process.env.CLOUDOPS_DEFAULT_MODE = "security";
      process.env.CLOUDOPS_DEFAULT_SERVICES = "EC2,RDS,S3";

      const effect = Effect.gen(function* () {
        const service = yield* ConfigService;
        return yield* service.mergeWithCLI({});
      });

      const merged = await runEffect(effect);
      expect(merged.defaultRegion).toBe("us-west-2");
      expect(merged.defaultAccount).toBe("123456789012");
      expect(merged.defaultFormat).toBe("json");
      expect(merged.defaultMode).toBe("security");
      expect(merged.defaultServices).toEqual(["EC2", "RDS", "S3"]);
    });
  });
});

describe("getConfigWithDefaults", () => {
  let tempHomeDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    tempHomeDir = await mkdtemp(join(tmpdir(), "cloudops-config-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tempHomeDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(tempHomeDir, { recursive: true });
  });

  test("CLI Option.Some overrides config", async () => {
    const configDir = join(tempHomeDir, ".config/cloudops-tools");
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, "config.json"), JSON.stringify({ defaultRegion: "eu-west-1" }));

    const effect = getConfigWithDefaults(
      Option.some("us-west-2"),
      Option.none(),
      undefined,
      undefined,
      Option.none(),
    );

    const config = await runEffect(effect);
    expect(config.region).toBe("us-west-2");
  });

  test("Option.None falls back to config then defaults", async () => {
    const configDir = join(tempHomeDir, ".config/cloudops-tools");
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, "config.json"), JSON.stringify({ defaultRegion: "eu-west-1" }));

    const effect = getConfigWithDefaults(
      Option.none(),
      Option.none(),
      undefined,
      undefined,
      Option.none(),
    );

    const config = await runEffect(effect);
    expect(config.region).toBe("eu-west-1");
    expect(config.format).toBe("csv");
    expect(config.mode).toBe("basic");
  });

  test("uses hardcoded defaults when no config", async () => {
    const effect = getConfigWithDefaults(
      Option.none(),
      Option.none(),
      undefined,
      undefined,
      Option.none(),
    );

    const config = await runEffect(effect);
    expect(config.region).toBe("us-east-1");
    expect(config.format).toBe("csv");
    expect(config.mode).toBe("basic");
    expect(config.skipGlobal).toBe(false);
    expect(config.onlyGlobal).toBe(false);
  });

  test("CLI format overrides config format", async () => {
    const configDir = join(tempHomeDir, ".config/cloudops-tools");
    await mkdir(configDir, { recursive: true });
    await writeFile(join(configDir, "config.json"), JSON.stringify({ defaultFormat: "xlsx" }));

    const effect = getConfigWithDefaults(
      Option.none(),
      Option.none(),
      "json",
      undefined,
      Option.none(),
    );

    const config = await runEffect(effect);
    expect(config.format).toBe("json");
  });

  test("CLI services override config services", async () => {
    const configDir = join(tempHomeDir, ".config/cloudops-tools");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, "config.json"),
      JSON.stringify({ defaultServices: ["EC2", "S3"] }),
    );

    const effect = getConfigWithDefaults(
      Option.none(),
      Option.none(),
      undefined,
      undefined,
      Option.some(["RDS", "Lambda"]),
    );

    const config = await runEffect(effect);
    expect(config.services).toEqual(["RDS", "Lambda"]);
  });
});
