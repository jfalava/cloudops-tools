import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { ConfigServiceLive, InventoryDbServiceLive } from "@cloudops-tools/sdk";
import { Command, CliConfig, HelpDoc, Span, ValidationError } from "@effect/cli";
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

import textArt from "../text-art.txt" with { type: "text" };

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

const STARTUP_BANNER = textArt.trimEnd();
const STARTUP_CONFIG_DIR = ".config/cloudops-tools";
const STARTUP_CONFIG_FILE = "config.json";

const isTruthyEnvFlag = (value: string | undefined): boolean => {
  if (value === undefined) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};

const getHomeDirForStartupConfig = (): string | undefined =>
  process.env.HOME || process.env.USERPROFILE;

const readBannerEnabledFromConfig = (): boolean => {
  const home = getHomeDirForStartupConfig();
  if (!home) {
    return true;
  }

  try {
    const configPath = join(home, STARTUP_CONFIG_DIR, STARTUP_CONFIG_FILE);
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as { showBanner?: unknown };
    return typeof parsed.showBanner === "boolean" ? parsed.showBanner : true;
  } catch {
    return true;
  }
};

const SHOULD_SHOW_STARTUP_BANNER =
  process.stdout.isTTY &&
  process.stderr.isTTY &&
  !isTruthyEnvFlag(process.env.CLOUDOPS_NO_BANNER) &&
  readBannerEnabledFromConfig();

const cli = Command.run(mainCommand, CLI_CONFIG);
const configCli = Command.run(configCommand, CLI_CONFIG);
const setupTotpCli = Command.run(setupTotpCommand, CLI_CONFIG);
const queryCli = Command.run(queryCommand, CLI_CONFIG);

const invocationPlan = planCliInvocation(process.argv);
const { debug } = invocationPlan;

const flattenHelpBlocks = (doc: HelpDoc.HelpDoc): ReadonlyArray<HelpDoc.HelpDoc> =>
  doc._tag === "Sequence"
    ? [...flattenHelpBlocks(doc.left), ...flattenHelpBlocks(doc.right)]
    : [doc];

const spanToPlainText = (span: Span.Span): string => {
  switch (span._tag) {
    case "Text":
    case "URI":
      return span.value;
    case "Highlight":
    case "Strong":
    case "Weak":
      return spanToPlainText(span.value);
    case "Sequence":
      return spanToPlainText(span.left) + spanToPlainText(span.right);
  }
};

const extractCompactCommandPath = (usageText: string): string => {
  const cleanedUsage = usageText
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\([^)]*\)/g, " ");

  const commandTokens = cleanedUsage
    .trim()
    .split(/\s+/)
    .filter((token) => /^[a-z0-9][a-z0-9-]*$/i.test(token));
  return commandTokens.join(" ");
};

const compactCommandsSection = (doc: HelpDoc.HelpDoc): HelpDoc.HelpDoc => {
  const blocks = flattenHelpBlocks(doc);
  const transformed: Array<HelpDoc.HelpDoc> = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!block) {
      continue;
    }
    const nextBlock = blocks[index + 1];

    const isCommandsHeader =
      block._tag === "Header" && block.level === 1 && spanToPlainText(block.value) === "COMMANDS";

    if (!isCommandsHeader || !nextBlock || nextBlock._tag !== "Enumeration") {
      transformed.push(block);
      continue;
    }

    const commandRows = nextBlock.elements
      .map((entry) => {
        if (entry._tag !== "Paragraph") {
          return undefined;
        }

        const line = spanToPlainText(entry.value).trim();
        if (line.length === 0) {
          return undefined;
        }

        const [usagePart = "", descriptionPart = ""] = line.split(/\s{2,}/, 2);
        const commandPath = extractCompactCommandPath(usagePart);

        if (commandPath.length === 0) {
          return undefined;
        }

        return {
          command: commandPath,
          description: descriptionPart.trim(),
        };
      })
      .filter((row): row is { command: string; description: string } => row !== undefined);

    if (commandRows.length === 0) {
      transformed.push(block, nextBlock);
      index += 1;
      continue;
    }

    const commandColumnWidth = Math.min(
      20,
      commandRows.reduce((max, row) => Math.max(max, row.command.length), 0),
    );

    const compactRows = commandRows.map((row) => {
      if (row.description.length === 0) {
        return HelpDoc.p(row.command);
      }
      return HelpDoc.p(`${row.command.padEnd(commandColumnWidth)}  ${row.description}`);
    });

    transformed.push(
      block,
      HelpDoc.enumeration(compactRows as [HelpDoc.HelpDoc, ...HelpDoc.HelpDoc[]]),
    );
    index += 1;
  }

  return HelpDoc.blocks(transformed);
};

if (SHOULD_SHOW_STARTUP_BANNER && STARTUP_BANNER.length > 0) {
  process.stderr.write(
    invocationPlan.action === "print-version"
      ? String(STARTUP_BANNER)
      : `${String(STARTUP_BANNER)}\n`,
  );
}

if (invocationPlan.action === "print-version") {
  const version = resolveCliVersion(
    typeof BUILD_VERSION !== "undefined" ? BUILD_VERSION : undefined,
    PACKAGE_VERSION,
  );
  process.stdout.write(` version: ${version}\n`);
  process.exit(0);
}

if (invocationPlan.action === "print-help") {
  const help = compactCommandsSection(Command.getHelp(mainCommand, CliConfig.defaultConfig));
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
