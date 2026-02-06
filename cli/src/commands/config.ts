import { ConfigService, type CloudOpsConfig } from "@cloudops-tools/sdk";
import { Command, Args } from "@effect/cli";
import { Effect, Console } from "effect";

import { ui } from "@/ui";

const setOptions = {
  key: Args.text({ name: "key" }),
  value: Args.text({ name: "value" }),
};

const configSetCommand = Command.make("set", setOptions, ({ key, value }) =>
  Effect.gen(function* (_) {
    const configService = yield* _(ConfigService);
    const config = yield* _(configService.loadConfig());

    const validKeys = [
      "defaultRegion",
      "defaultAccount",
      "defaultFormat",
      "defaultMode",
      "defaultServices",
      "skipGlobal",
      "onlyGlobal",
    ];

    if (!validKeys.includes(key)) {
      yield* _(Console.log(ui.error(`Invalid config key: ${key}`)));
      yield* _(Console.log(ui.info(`Valid keys: ${validKeys.join(", ")}`)));
      return;
    }

    let parsedValue: unknown = value;
    if (key === "skipGlobal" || key === "onlyGlobal") {
      parsedValue = value.toLowerCase() === "true";
    } else if (key === "defaultServices") {
      parsedValue = value.split(",").map((s) => s.trim());
    }

    const updatedConfig: CloudOpsConfig = { ...config, [key]: parsedValue };
    yield* _(configService.saveConfig(updatedConfig));
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
        const value = config[key.value as keyof CloudOpsConfig];
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

    if (!(key in config)) {
      yield* _(Console.log(ui.info(`${key} is not set`)));
      return;
    }

    const updatedConfig = { ...config };
    delete updatedConfig[key as keyof CloudOpsConfig];
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

export const configCommand = Command.make("config", {}, () =>
  Effect.gen(function* (_) {
    const configService = yield* _(ConfigService);
    const config = yield* _(configService.loadConfig());

    yield* _(Console.log(ui.info("Current configuration:")));
    if (Object.keys(config).length === 0) {
      yield* _(Console.log("  (no configuration set)"));
      yield* _(Console.log(""));
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
