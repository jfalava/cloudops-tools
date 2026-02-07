import { ConfigServiceLive } from "@cloudops-tools/sdk";
import { Command, CliConfig, HelpDoc, ValidationError } from "@effect/cli";
import { BunRuntime, BunContext } from "@effect/platform-bun";
import { argv } from "bun";
import { Effect } from "effect";
import { readFileSync } from "node:fs";
import process from "node:process";

import { HELP_EXAMPLES, configCommand, mainCommand, setupTotpCommand } from "@/commands";

declare const BUILD_VERSION: string | undefined;

const CLI_CONFIG = {
  name: "CloudOps Tools",
  version: "0.1.0",
} as const;

const cli = Command.run(mainCommand, CLI_CONFIG);
const configCli = Command.run(configCommand, CLI_CONFIG);
const setupTotpCli = Command.run(setupTotpCommand, CLI_CONFIG);

const args = argv.slice(2);
const forceInit = args.includes("--init");
const forceSetupTotp = args.includes("--setup-totp");
const debug = args.includes("--debug");
const wantsHelp = args.length === 0 || args.includes("--help") || args.includes("-h");
const wantsVersion = args.includes("--version");
const wantsHelpExamples = args.includes("--help-examples");

if (wantsVersion) {
  const version =
    typeof BUILD_VERSION !== "undefined"
      ? BUILD_VERSION
      : (() => {
          try {
            const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
            const parsed = JSON.parse(packageJson) as { version?: string };
            return parsed.version ?? "unknown";
          } catch {
            return "unknown";
          }
        })();
  process.stdout.write(String(version) + "\n");
  process.exit(0);
}

if (wantsHelp && !forceInit && !forceSetupTotp) {
  const help = Command.getHelp(mainCommand, CliConfig.defaultConfig);
  process.stdout.write(HelpDoc.toAnsiText(help) + "\n");
  process.exit(0);
}

if (wantsHelpExamples && !forceInit && !forceSetupTotp) {
  process.stdout.write(String(HELP_EXAMPLES.trim()) + "\n");
  process.exit(0);
}

const normalizedArgs = forceSetupTotp
  ? [...argv.slice(0, 2), "setup-totp", ...args.filter((arg) => arg !== "--setup-totp")]
  : forceInit
    ? [...argv.slice(0, 2), "init", ...args.filter((arg) => arg !== "--init")]
    : argv;
const normalizedArgsForDetection = normalizedArgs.slice(2);
const wantsSetupTotp = forceSetupTotp || normalizedArgsForDetection.includes("setup-totp");
const wantsConfig = normalizedArgsForDetection.includes("config");

const stripFirstToken = (input: ReadonlyArray<string>, token: string): ReadonlyArray<string> => {
  let removed = false;
  return input.filter((arg, index) => {
    if (index < 2) {
      return true;
    }
    if (!removed && arg === token) {
      removed = true;
      return false;
    }
    return true;
  });
};

const stripTokens = (
  input: ReadonlyArray<string>,
  tokens: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  if (tokens.length === 0) {
    return input;
  }
  return input.filter((arg, index) => (index < 2 ? true : !tokens.includes(arg)));
};

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
            return Effect.succeed(undefined);
          }
          return Effect.sync(() => {
            console.error(formatError(error));
            process.exitCode = 1;
          });
        }),
      );

const selectedCli = wantsSetupTotp ? setupTotpCli : wantsConfig ? configCli : cli;
const argsForSelectedCli = wantsSetupTotp
  ? stripTokens(stripFirstToken(normalizedArgs, "setup-totp"), ["--debug"])
  : wantsConfig
    ? stripTokens(stripFirstToken(normalizedArgs, "config"), ["--debug"])
    : normalizedArgs;
const baseEffect = selectedCli(argsForSelectedCli);

const provided = baseEffect.pipe(
  Effect.provide(ConfigServiceLive),
  Effect.provide(BunContext.layer),
);

withErrorHandling(provided).pipe(BunRuntime.runMain);
