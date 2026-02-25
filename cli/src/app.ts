import { readFileSync } from "node:fs";
import process from "node:process";

import { ConfigServiceLive, InventoryDbServiceLive } from "@cloudops-tools/sdk";
import { Command, CliConfig, HelpDoc, ValidationError } from "@effect/cli";
import { BunRuntime, BunContext } from "@effect/platform-bun";
import { Effect, Layer } from "effect";

import {
  HELP_EXAMPLES,
  configCommand,
  mainCommand,
  setupTotpCommand,
  queryCommand,
} from "@/commands";
import { planCliInvocation } from "@/lib/startup-args";
import { formatCliUserInputError, isCliUserInputError } from "@/lib/user-input-error";
import { resolveCliVersion } from "@/lib/version";

declare const BUILD_VERSION: string | undefined;

const PACKAGE_VERSION = (() => {
  try {
    const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    const parsed = JSON.parse(packageJson) as { version?: string };
    return parsed.version ?? "unknown";
  } catch {
    return "unknown";
  }
})();

const CLI_CONFIG = {
  name: "CloudOps Tools",
  version: PACKAGE_VERSION,
} as const;

const cli = Command.run(mainCommand, CLI_CONFIG);
const configCli = Command.run(configCommand, CLI_CONFIG);
const setupTotpCli = Command.run(setupTotpCommand, CLI_CONFIG);
const queryCli = Command.run(queryCommand, CLI_CONFIG);

const invocationPlan = planCliInvocation(process.argv);
const { debug } = invocationPlan;

if (invocationPlan.action === "print-version") {
  const version = resolveCliVersion(
    typeof BUILD_VERSION !== "undefined" ? BUILD_VERSION : undefined,
    PACKAGE_VERSION,
  );
  process.stdout.write(version + "\n");
  process.exit(0);
}

if (invocationPlan.action === "print-help") {
  const help = Command.getHelp(mainCommand, CliConfig.defaultConfig);
  process.stdout.write(HelpDoc.toAnsiText(help) + "\n");
  process.exit(0);
}

if (invocationPlan.action === "print-help-examples") {
  process.stdout.write(String(HELP_EXAMPLES.trim()) + "\n");
  process.exit(0);
}

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const withErrorHandling = <R>(effect: Effect.Effect<void, unknown, R>) =>
  debug
    ? effect
    : effect.pipe(
        Effect.catchAll((error) => {
          if (ValidationError.isValidationError(error)) {
            return Effect.sync(() => {
              // @effect/cli already prints validation/help text; preserve correct exit semantics.
              process.exitCode = ValidationError.isHelpRequested(error) ? 0 : 2;
            });
          }
          if (isCliUserInputError(error)) {
            return Effect.sync(() => {
              console.error(formatCliUserInputError(error));
              process.exitCode = 2;
            });
          }
          return Effect.sync(() => {
            console.error(formatError(error));
            process.exitCode = 1;
          });
        }),
      );

const selectedCli =
  invocationPlan.selectedCli === "setup-totp"
    ? setupTotpCli
    : invocationPlan.selectedCli === "config"
      ? configCli
      : invocationPlan.selectedCli === "query"
        ? queryCli
        : cli;
const baseEffect = selectedCli(invocationPlan.argsForSelectedCli);

const baseLayer = Layer.merge(ConfigServiceLive, InventoryDbServiceLive);

const provided = baseEffect.pipe(Effect.provide(baseLayer), Effect.provide(BunContext.layer));

withErrorHandling(provided).pipe(BunRuntime.runMain);
