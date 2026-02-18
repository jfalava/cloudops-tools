import { mkdir } from "node:fs/promises";

import {
  generateInitInventoryEffect,
  SdkLive,
  DatabaseService,
  ComputeService,
  NetworkingService,
  ReportingService,
  UtilService,
} from "@cloudops-tools/sdk";
import { Command } from "@effect/cli";
import { write } from "bun";
import { Effect, Option, Console } from "effect";

import { configCommand } from "@/commands/config";
import { describeCommand } from "@/commands/describe";
import { getDescribeHandler } from "@/commands/describe-handlers";
import { initCommand } from "@/commands/init";
import { queryCommand } from "@/commands/query";
import { setupTotpCommand } from "@/commands/setup-totp";
import { requireLetmeActivation } from "@/lib/letme";
import {
  account as accountOption,
  region as regionOption,
  exportFormat,
  debugOption,
  skipGlobalOption,
  onlyGlobalOption,
  describeOption,
  servicesOption,
  helpExamplesOption,
  useLetmeOption,
  noCacheOption,
} from "@/options";
import { startProgressRenderer } from "@/progress";
import { ui } from "@/ui";

const HELP_DESCRIPTION = "CloudOps Tools - AWS inventory CLI";

export const HELP_EXAMPLES = `
Examples:
  # Basic inventory for a specific region
  cloudops-tools --region us-east-1

  # Cross-region security-focused inventory (Excel)
  cloudops-tools init --mode security --export-format xlsx

  # Scan only specific services
  cloudops-tools --services EC2,RDS,S3 --region us-east-1
  cloudops-tools init --services Lambda,DynamoDB,SQS

  # Deeply describe an EC2 instance
  cloudops-tools describe ec2 us-east-1 i-1234567890abcdef0

  # Describe all resources of a type in a region (writes Markdown file)
  cloudops-tools --describe rds --region eu-south-2
  cloudops-tools --describe ec2 --region eu-south-2
  cloudops-tools --describe lambda --region eu-south-2
  cloudops-tools --describe vpc --region eu-south-2
  cloudops-tools --describe dynamodb --region eu-south-2

  # Manage persistent configuration
  cloudops-tools config set defaultRegion eu-west-1
  cloudops-tools config set defaultFormat xlsx
  cloudops-tools config get

  # Setup TOTP for 'letme' MFA
  cloudops-tools setup-totp

  # Use letme to obtain credentials and run scan (profile from --account)
  cloudops-tools --use-letme --account engineering-prod --region us-east-1
`;

export const mainCommand = Command.make(
  "cloudops-tools",
  {
    account: accountOption,
    region: regionOption,
    format: exportFormat,
    debug: debugOption,
    skipGlobal: skipGlobalOption,
    onlyGlobal: onlyGlobalOption,
    describe: describeOption,
    services: servicesOption,
    helpExamples: helpExamplesOption,
    useLetme: useLetmeOption,
    noCache: noCacheOption,
  },
  ({
    account,
    region,
    format,
    debug,
    skipGlobal,
    onlyGlobal,
    describe: describeSelection,
    services,
    helpExamples,
    useLetme,
    noCache,
  }) =>
    Effect.gen(function* () {
      if (helpExamples) {
        yield* Console.log(HELP_EXAMPLES.trim());
        return;
      }

      if (useLetme) {
        yield* requireLetmeActivation(
          account,
          "cloudops-tools --use-letme --account engineering-prod",
        );
      }

      const runWithSdk = Effect.gen(function* () {
        const util = yield* UtilService;
        const id = yield* Option.match(account, {
          onNone: () => util.getAccountId(),
          onSome: (value) => Effect.succeed(value),
        });
        const regions = region.split(",").map((r) => r.trim());

        const describeType = Option.getOrUndefined(describeSelection);
        if (describeType) {
          const database = yield* DatabaseService;
          const compute = yield* ComputeService;
          const networking = yield* NetworkingService;
          const reporting = yield* ReportingService;

          const handler = getDescribeHandler(describeType, {
            database,
            compute,
            networking,
            useCache: !noCache,
            cacheTtlSeconds: 300,
          });
          if (!handler) {
            yield* Console.log(ui.error(`Unsupported --describe type: ${describeType}`));
            return;
          }

          const itemsByRegion = yield* Effect.forEach(regions, handler.fetchByRegion);
          const items = itemsByRegion.flat();

          if (items.length === 0) {
            yield* Console.log(ui.info(`No ${handler.title} found in ${regions.join(", ")}`));
            return;
          }

          const report = yield* reporting.generateMarkdownReport(handler.title, items);
          const now = new Date().toISOString();
          const date = now.slice(0, 10).replace(/-/g, "");
          const time = now.slice(11, 19).replace(/:/g, "");
          const safeRegions = regions.join("-").replace(/[^a-zA-Z0-9-]/g, "-");
          const outputDir = `inventory-output/${id}`;
          const outputPath = `${outputDir}/describe-${describeType.toLowerCase()}-${safeRegions}-${date}-${time}.md`;

          yield* Effect.tryPromise({
            try: () => mkdir(outputDir, { recursive: true }),
            catch: (error) =>
              new Error(`Failed to create output directory "${outputDir}": ${String(error)}`),
          });
          yield* Effect.tryPromise({
            try: () => write(outputPath, report),
            catch: (error) =>
              new Error(`Failed to write report to "${outputPath}": ${String(error)}`),
          });
          yield* Console.log(ui.success(`Wrote ${outputPath}`));
          return;
        }

        const serviceList = Option.match(services, {
          onNone: () => undefined,
          onSome: (s: string) =>
            s.toLowerCase() === "all" ? undefined : s.split(",").map((svc) => svc.trim()),
        });

        const progress = yield* Effect.sync(() => startProgressRenderer({ debug }));
        yield* generateInitInventoryEffect(id, "basic", format, regions, debug, {
          skipGlobal,
          onlyGlobal,
          services: serviceList,
        }).pipe(Effect.ensuring(Effect.sync(() => progress.stop())));
      });

      yield* runWithSdk.pipe(Effect.provide(SdkLive));
    }),
).pipe(
  Command.withSubcommands([
    setupTotpCommand,
    initCommand,
    describeCommand,
    configCommand,
    queryCommand,
  ]),
  Command.withDescription(HELP_DESCRIPTION),
);
