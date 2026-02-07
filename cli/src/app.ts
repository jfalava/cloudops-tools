import { SdkLive } from "@cloudops-tools/sdk";
import { Command, CliConfig, HelpDoc, ValidationError } from "@effect/cli";
import { BunRuntime, BunContext } from "@effect/platform-bun";
import { argv } from "bun";
import { Effect } from "effect";
import process from "node:process";

import { HELP_EXAMPLES, mainCommand } from "@/commands";

const cli = Command.run(mainCommand, {
  name: "CloudOps Tools",
  version: "0.1.0",
});

const args = argv.slice(2);
const forceInit = args.includes("--init");
const debug = args.includes("--debug");
const wantsHelp = args.length === 0 || args.includes("--help") || args.includes("-h");
const wantsVersion = args.includes("--version");
const wantsHelpExamples = args.includes("--help-examples");

if (wantsVersion) {
  const version =
    typeof BUILD_VERSION !== "undefined"
      ? BUILD_VERSION
      : await Bun.file(new URL("../package.json", import.meta.url))
          .json()
          .then((data) => (data as { version: string }).version)
          .catch(() => "unknown");
  process.stdout.write(`${version}\n`);
  process.exit(0);
}

if (wantsHelp && !forceInit) {
  const help = Command.getHelp(mainCommand, CliConfig.defaultConfig);
  process.stdout.write(HelpDoc.toAnsiText(help) + "\n");
  process.exit(0);
}

if (wantsHelpExamples && !forceInit) {
  process.stdout.write(`${HELP_EXAMPLES.trim()}\n`);
  process.exit(0);
}

const normalizedArgs = forceInit
  ? [...argv.slice(0, 2), "init", ...args.filter((arg) => arg !== "--init")]
  : argv;

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

withErrorHandling(
  cli(normalizedArgs).pipe(Effect.provide(SdkLive), Effect.provide(BunContext.layer)),
).pipe(BunRuntime.runMain);
