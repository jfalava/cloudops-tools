import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Context, Effect, Layer, Option } from "effect";

export interface CloudOpsConfig {
  defaultRegion?: string;
  defaultAccount?: string;
  defaultFormat?: "csv" | "xlsx" | "json" | "both" | "all";
  defaultMode?: "basic" | "detailed" | "security" | "cost";
  defaultServices?: string[];
  showBanner?: boolean;
  skipGlobal?: boolean;
  onlyGlobal?: boolean;
}

const CONFIG_DIR = ".config/cloudops-tools";
const CONFIG_FILE = "config.json";

const DEFAULT_CONFIG: CloudOpsConfig = {};

const getHomeDir = (): string => {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    throw new Error("Could not determine home directory");
  }
  return home;
};

export interface ConfigService {
  readonly getConfigPath: () => Effect.Effect<string, never>;
  readonly loadConfig: () => Effect.Effect<CloudOpsConfig, never>;
  readonly saveConfig: (config: CloudOpsConfig) => Effect.Effect<void, never>;
  readonly mergeWithCLI: <T extends Partial<CloudOpsConfig>>(
    cliOptions: T,
  ) => Effect.Effect<CloudOpsConfig & T, never>;
}

export const ConfigService = Context.GenericTag<ConfigService>("@sdk/lib/ConfigService");

export const ConfigServiceLive = Layer.succeed(
  ConfigService,
  ConfigService.of({
    getConfigPath: () =>
      Effect.sync(() => {
        const home = getHomeDir();
        return join(home, CONFIG_DIR, CONFIG_FILE);
      }),

    loadConfig: () =>
      Effect.gen(function* (_) {
        const home = getHomeDir();
        const configPath = join(home, CONFIG_DIR, CONFIG_FILE);

        const exists = existsSync(configPath);
        if (!exists) {
          return DEFAULT_CONFIG;
        }

        const content = yield* _(
          Effect.tryPromise({
            try: () => readFile(configPath, "utf-8"),
            catch: () => "{}",
          }).pipe(Effect.catchAll(() => Effect.succeed("{}"))),
        );

        try {
          return JSON.parse(content) as CloudOpsConfig;
        } catch {
          return DEFAULT_CONFIG;
        }
      }),

    saveConfig: (config: CloudOpsConfig) =>
      Effect.gen(function* (_) {
        const home = getHomeDir();
        const configDir = join(home, CONFIG_DIR);
        const configPath = join(configDir, CONFIG_FILE);

        yield* _(
          Effect.tryPromise({
            try: () => mkdir(configDir, { recursive: true }),
            catch: () => undefined,
          }).pipe(Effect.catchAll(() => Effect.void)),
        );

        yield* _(
          Effect.tryPromise({
            try: () => writeFile(configPath, JSON.stringify(config, null, 2)),
            catch: () => undefined,
          }).pipe(Effect.catchAll(() => Effect.void)),
        );
      }),

    mergeWithCLI: <T extends Partial<CloudOpsConfig>>(cliOptions: T) =>
      Effect.gen(function* (_) {
        const home = getHomeDir();
        const configPath = join(home, CONFIG_DIR, CONFIG_FILE);

        let fileConfig: CloudOpsConfig = DEFAULT_CONFIG;

        const exists = existsSync(configPath);
        if (exists) {
          const content = yield* _(
            Effect.tryPromise({
              try: () => readFile(configPath, "utf-8"),
              catch: () => "{}",
            }).pipe(Effect.catchAll(() => Effect.succeed("{}"))),
          );
          try {
            fileConfig = JSON.parse(content) as CloudOpsConfig;
          } catch {
            fileConfig = DEFAULT_CONFIG;
          }
        }

        const envConfig: Partial<CloudOpsConfig> = {};
        if (process.env.CLOUDOPS_DEFAULT_REGION) {
          envConfig.defaultRegion = process.env.CLOUDOPS_DEFAULT_REGION;
        }
        if (process.env.CLOUDOPS_DEFAULT_ACCOUNT) {
          envConfig.defaultAccount = process.env.CLOUDOPS_DEFAULT_ACCOUNT;
        }
        if (process.env.CLOUDOPS_DEFAULT_FORMAT) {
          envConfig.defaultFormat = process.env
            .CLOUDOPS_DEFAULT_FORMAT as CloudOpsConfig["defaultFormat"];
        }
        if (process.env.CLOUDOPS_DEFAULT_MODE) {
          envConfig.defaultMode = process.env
            .CLOUDOPS_DEFAULT_MODE as CloudOpsConfig["defaultMode"];
        }
        if (process.env.CLOUDOPS_DEFAULT_SERVICES) {
          envConfig.defaultServices = process.env.CLOUDOPS_DEFAULT_SERVICES.split(",").map((s) =>
            s.trim(),
          );
        }

        return {
          ...fileConfig,
          ...envConfig,
          ...cliOptions,
        } as CloudOpsConfig & T;
      }),
  }),
);

export const getConfigWithDefaults = (
  cliRegion: Option.Option<string>,
  cliAccount: Option.Option<string>,
  cliFormat: string | undefined,
  cliMode: string | undefined,
  cliServices: Option.Option<string[]>,
) =>
  Effect.gen(function* (_) {
    const configService = yield* _(ConfigService);
    const config = yield* _(configService.loadConfig());

    return {
      region: Option.getOrElse(cliRegion, () => config.defaultRegion ?? "us-east-1"),
      account: Option.getOrElse(cliAccount, () => config.defaultAccount),
      format: cliFormat ?? config.defaultFormat ?? "csv",
      mode: cliMode ?? config.defaultMode ?? "basic",
      services: Option.getOrElse(cliServices, () => config.defaultServices),
      skipGlobal: config.skipGlobal ?? false,
      onlyGlobal: config.onlyGlobal ?? false,
    };
  });
