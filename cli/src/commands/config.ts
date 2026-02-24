import { ConfigService, type CloudOpsConfig } from "@cloudops-tools/sdk";
import { Command, Args, Options } from "@effect/cli";
import { Effect, Console } from "effect";

import { parseCsvValues } from "@/lib/option-validation";
import { invalidUserInput } from "@/lib/user-input-error";
import { ui } from "@/ui";

const setOptions = {
  key: Args.text({ name: "key" }),
  value: Args.text({ name: "value" }),
};

const writeDefaultsOption = Options.boolean("write-defaults").pipe(
  Options.withDescription(
    "Create/backfill config.json with sensible defaults (preserves existing values)",
  ),
);

const VALID_CONFIG_KEYS = [
  "defaultRegion",
  "defaultAccount",
  "defaultFormat",
  "defaultMode",
  "defaultServices",
  "skipGlobal",
  "onlyGlobal",
] as const;
type ValidConfigKey = (typeof VALID_CONFIG_KEYS)[number];

const DEFAULT_FORMAT_VALUES = ["csv", "xlsx", "json", "both", "all"] as const;
const DEFAULT_MODE_VALUES = ["basic", "detailed", "security", "cost"] as const;
const BASE_CONFIG_DEFAULTS: CloudOpsConfig = {
  defaultRegion: "us-east-1",
  defaultFormat: "csv",
  defaultMode: "basic",
  skipGlobal: false,
  onlyGlobal: false,
};

type ConfigParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: Error };

const isValidConfigKey = (key: string): key is ValidConfigKey =>
  VALID_CONFIG_KEYS.includes(key as ValidConfigKey);

const parseBooleanConfigValue = (
  key: "skipGlobal" | "onlyGlobal",
  value: string,
): ConfigParseResult<boolean> => {
  const normalized = value.trim().toLowerCase();
  if (normalized !== "true" && normalized !== "false") {
    return {
      ok: false as const,
      error: invalidUserInput(`Invalid value for ${key}: "${value}". Expected true or false.`, {
        example: `cloudops-tools config set ${key} true`,
      }),
    };
  }

  return { ok: true as const, value: normalized === "true" };
};

const parseDefaultFormatConfigValue = (
  value: string,
): ConfigParseResult<CloudOpsConfig["defaultFormat"]> => {
  const normalized = value.trim().toLowerCase();
  if (!DEFAULT_FORMAT_VALUES.includes(normalized as (typeof DEFAULT_FORMAT_VALUES)[number])) {
    return {
      ok: false,
      error: invalidUserInput(
        `Invalid value for defaultFormat: "${value}". Expected one of: ${DEFAULT_FORMAT_VALUES.join(", ")}.`,
        { example: "cloudops-tools config set defaultFormat xlsx" },
      ),
    };
  }
  return { ok: true, value: normalized as CloudOpsConfig["defaultFormat"] };
};

const parseDefaultModeConfigValue = (
  value: string,
): ConfigParseResult<CloudOpsConfig["defaultMode"]> => {
  const normalized = value.trim().toLowerCase();
  if (!DEFAULT_MODE_VALUES.includes(normalized as (typeof DEFAULT_MODE_VALUES)[number])) {
    return {
      ok: false,
      error: invalidUserInput(
        `Invalid value for defaultMode: "${value}". Expected one of: ${DEFAULT_MODE_VALUES.join(", ")}.`,
        { example: "cloudops-tools config set defaultMode security" },
      ),
    };
  }
  return { ok: true, value: normalized as CloudOpsConfig["defaultMode"] };
};

const parseDefaultServicesConfigValue = (value: string): ConfigParseResult<string[]> => {
  const parsed = parseCsvValues(
    "defaultServices",
    value,
    "cloudops-tools config set defaultServices EC2,RDS,S3",
  );
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  return { ok: true, value: parsed.values };
};

type ConfigSetUpdateResult =
  | { readonly ok: true; readonly config: CloudOpsConfig }
  | { readonly ok: false; readonly error: Error };

const toConfigSetSuccess = (config: CloudOpsConfig): ConfigSetUpdateResult => ({
  ok: true,
  config,
});

const configSetHandlers = {
  defaultRegion: (config: CloudOpsConfig, value: string): ConfigSetUpdateResult =>
    toConfigSetSuccess({ ...config, defaultRegion: value }),
  defaultAccount: (config: CloudOpsConfig, value: string): ConfigSetUpdateResult =>
    toConfigSetSuccess({ ...config, defaultAccount: value }),
  defaultFormat: (config: CloudOpsConfig, value: string): ConfigSetUpdateResult => {
    const parsed = parseDefaultFormatConfigValue(value);
    if (!parsed.ok) {
      return parsed;
    }
    return toConfigSetSuccess({ ...config, defaultFormat: parsed.value });
  },
  defaultMode: (config: CloudOpsConfig, value: string): ConfigSetUpdateResult => {
    const parsed = parseDefaultModeConfigValue(value);
    if (!parsed.ok) {
      return parsed;
    }
    return toConfigSetSuccess({ ...config, defaultMode: parsed.value });
  },
  defaultServices: (config: CloudOpsConfig, value: string): ConfigSetUpdateResult => {
    const parsed = parseDefaultServicesConfigValue(value);
    if (!parsed.ok) {
      return parsed;
    }
    return toConfigSetSuccess({ ...config, defaultServices: parsed.value });
  },
  skipGlobal: (config: CloudOpsConfig, value: string): ConfigSetUpdateResult => {
    const parsed = parseBooleanConfigValue("skipGlobal", value);
    if (!parsed.ok) {
      return parsed;
    }
    return toConfigSetSuccess({ ...config, skipGlobal: parsed.value });
  },
  onlyGlobal: (config: CloudOpsConfig, value: string): ConfigSetUpdateResult => {
    const parsed = parseBooleanConfigValue("onlyGlobal", value);
    if (!parsed.ok) {
      return parsed;
    }
    return toConfigSetSuccess({ ...config, onlyGlobal: parsed.value });
  },
} satisfies Record<
  ValidConfigKey,
  (config: CloudOpsConfig, value: string) => ConfigSetUpdateResult
>;

const buildUpdatedConfigForSet = (
  config: CloudOpsConfig,
  key: ValidConfigKey,
  value: string,
): ConfigSetUpdateResult => configSetHandlers[key](config, value);

const configSetCommand = Command.make("set", setOptions, ({ key, value }) =>
  Effect.gen(function* (_) {
    const configService = yield* _(ConfigService);
    const config = yield* _(configService.loadConfig());

    if (!isValidConfigKey(key)) {
      return yield* _(
        Effect.fail(
          invalidUserInput(`Invalid config key: ${key}.`, {
            hint: `Valid keys: ${VALID_CONFIG_KEYS.join(", ")}`,
            example: "cloudops-tools config set defaultRegion us-east-1",
          }),
        ),
      );
    }

    const updated = buildUpdatedConfigForSet(config, key, value);
    if (!updated.ok) {
      return yield* _(Effect.fail(updated.error));
    }
    yield* _(configService.saveConfig(updated.config));
    yield* _(Console.log(ui.success(`Set ${key} = ${value}`)));
  }),
).pipe(Command.withDescription("Set a configuration value"));

const configGetCommand = Command.make(
  "get",
  { key: Args.optional(Args.text({ name: "key" })) },
  ({ key }) =>
    Effect.gen(function* (_) {
      const configService = yield* _(ConfigService);
      const config = yield* _(configService.loadConfig());

      if (key._tag === "Some") {
        if (!isValidConfigKey(key.value)) {
          yield* _(Console.log(ui.error(`${key.value} is not a valid config key`)));
          return;
        }

        const value = config[key.value];
        if (value === undefined) {
          yield* _(Console.log(ui.info(`${key.value} is not set`)));
        } else {
          yield* _(Console.log(`${key.value} = ${JSON.stringify(value)}`));
        }
      } else {
        yield* _(Console.log(ui.info("Current configuration:")));
        if (Object.keys(config).length === 0) {
          yield* _(Console.log("  (no configuration set)"));
        } else {
          for (const [k, v] of Object.entries(config)) {
            yield* _(Console.log(`  ${k} = ${JSON.stringify(v)}`));
          }
        }
      }
    }),
).pipe(Command.withDescription("Get configuration value(s)"));

const configUnsetCommand = Command.make("unset", { key: Args.text({ name: "key" }) }, ({ key }) =>
  Effect.gen(function* (_) {
    const configService = yield* _(ConfigService);
    const config = yield* _(configService.loadConfig());

    if (!isValidConfigKey(key)) {
      yield* _(Console.log(ui.error(`${key} is not a valid config key`)));
      return;
    }

    if (!(key in config)) {
      yield* _(Console.log(ui.info(`${key} is not set`)));
      return;
    }

    const updatedConfig = { ...config };
    delete updatedConfig[key];
    yield* _(configService.saveConfig(updatedConfig));
    yield* _(Console.log(ui.success(`Unset ${key}`)));
  }),
).pipe(Command.withDescription("Unset a configuration value"));

const configPathCommand = Command.make("path", {}, () =>
  Effect.gen(function* (_) {
    const configService = yield* _(ConfigService);
    const configPath = yield* _(configService.getConfigPath());
    yield* _(Console.log(configPath));
  }),
).pipe(Command.withDescription("Show the configuration file path"));

export const configCommand = Command.make(
  "config",
  { writeDefaults: writeDefaultsOption },
  ({ writeDefaults }) =>
    Effect.gen(function* (_) {
      const configService = yield* _(ConfigService);
      const config = yield* _(configService.loadConfig());
      const configPath = yield* _(configService.getConfigPath());

      if (writeDefaults) {
        const mergedConfig: CloudOpsConfig = {
          ...BASE_CONFIG_DEFAULTS,
          ...config,
        };
        yield* _(configService.saveConfig(mergedConfig));

        const hadExistingValues = Object.keys(config).length > 0;
        yield* _(
          Console.log(
            ui.success(
              hadExistingValues
                ? `Wrote base config defaults to ${configPath} (preserved existing values)`
                : `Wrote base config defaults to ${configPath}`,
            ),
          ),
        );
        yield* _(
          Console.log(
            ui.info(
              "Defaults written: defaultRegion, defaultFormat, defaultMode, skipGlobal, onlyGlobal",
            ),
          ),
        );
        return;
      }

      yield* _(Console.log(ui.info("Current configuration:")));
      if (Object.keys(config).length === 0) {
        yield* _(Console.log("  (no configuration set)"));
        yield* _(Console.log(""));
        yield* _(
          Console.log("Use 'cloudops-tools config --write-defaults' to create a base config file."),
        );
        yield* _(Console.log("Use 'cloudops-tools config set <key> <value>' to set values."));
        yield* _(
          Console.log(
            "Valid keys: defaultRegion, defaultAccount, defaultFormat, defaultMode, defaultServices, skipGlobal, onlyGlobal",
          ),
        );
      } else {
        for (const [k, v] of Object.entries(config)) {
          yield* _(Console.log(`  ${k} = ${JSON.stringify(v)}`));
        }
      }
    }),
).pipe(
  Command.withSubcommands([
    configSetCommand,
    configGetCommand,
    configUnsetCommand,
    configPathCommand,
  ]),
  Command.withDescription("Manage persistent configuration"),
);
