import { generateInitInventoryEffect, SdkLive, UtilService } from "@cloudops-tools/sdk";
import { Command } from "@effect/cli";
import { Effect, Option } from "effect";

import { requireLetmeActivation } from "@/lib/letme";
import { parseCsvValues, parseServicesOption } from "@/lib/option-validation";
import { invalidUserInput } from "@/lib/user-input-error";
import {
  account as accountOption,
  initRegions,
  limitRegions as limitRegionsOption,
  exportFormat,
  debugOption,
  skipGlobalOption,
  onlyGlobalOption,
  incrementalOption,
  minIntervalOption,
  modeOption,
  servicesOption,
  useLetmeOption,
} from "@/options";
import { startProgressRenderer } from "@/progress";

export const initCommand = Command.make(
  "init",
  {
    account: accountOption,
    region: initRegions,
    limitRegions: limitRegionsOption,
    format: exportFormat,
    debug: debugOption,
    skipGlobal: skipGlobalOption,
    onlyGlobal: onlyGlobalOption,
    incremental: incrementalOption,
    minInterval: minIntervalOption,
    mode: modeOption,
    services: servicesOption,
    useLetme: useLetmeOption,
  },
  ({
    account,
    region,
    limitRegions,
    format,
    mode,
    debug,
    skipGlobal,
    onlyGlobal,
    incremental,
    minInterval,
    services,
    useLetme,
  }) =>
    Effect.gen(function* (_) {
      if (skipGlobal && onlyGlobal) {
        yield* _(
          Effect.fail(
            invalidUserInput(
              "Invalid option combination: --skip-global cannot be used with --only-global.",
              { example: "cloudops-tools init --only-global" },
            ),
          ),
        );
      }

      if (Option.isSome(region) && Option.isSome(limitRegions)) {
        yield* _(
          Effect.fail(
            invalidUserInput(
              "Invalid option combination: use only one of --region or --limit-regions.",
              { hint: "--region already limits the scan to specific regions." },
            ),
          ),
        );
      }

      if (Option.isSome(minInterval) && minInterval.value <= 0) {
        yield* _(
          Effect.fail(
            invalidUserInput(
              `Invalid value for --min-interval: ${String(minInterval.value)}. Expected a positive integer (minutes).`,
              { example: "cloudops-tools init --incremental --min-interval 15" },
            ),
          ),
        );
      }

      const parsedRegions = Option.match(region, {
        onNone: () => undefined,
        onSome: (raw: string) =>
          parseCsvValues("--region", raw, "cloudops-tools init --region us-east-1,us-west-2"),
      });
      if (parsedRegions && !parsedRegions.ok) {
        yield* _(Effect.fail(parsedRegions.error));
      }

      const parsedLimitRegions = Option.match(limitRegions, {
        onNone: () => undefined,
        onSome: (raw: string) =>
          parseCsvValues(
            "--limit-regions",
            raw,
            "cloudops-tools init --limit-regions us-east-1,us-west-2",
          ),
      });
      if (parsedLimitRegions && !parsedLimitRegions.ok) {
        yield* _(Effect.fail(parsedLimitRegions.error));
      }

      const parsedServices = Option.match(services, {
        onNone: () => ({ ok: true as const, values: undefined }),
        onSome: (raw: string) =>
          parseServicesOption(raw, {
            list: "cloudops-tools init --services EC2,RDS,S3 --region us-east-1",
            all: "cloudops-tools init --services all",
          }),
      });
      if (!parsedServices.ok) {
        yield* _(Effect.fail(parsedServices.error));
      }

      if (useLetme) {
        yield* _(
          requireLetmeActivation(
            account,
            "cloudops-tools init --use-letme --account engineering-prod",
          ),
        );
      }

      const runWithSdk = Effect.gen(function* (__inner) {
        const progress = yield* __inner(Effect.sync(() => startProgressRenderer({ debug })));
        const util = yield* __inner(UtilService);
        const id = yield* __inner(
          Option.match(account, {
            onNone: () => util.getAccountId(),
            onSome: (value) => Effect.succeed(value),
          }),
        );
        const regions =
          parsedRegions?.ok === true ? Option.some(parsedRegions.values) : Option.none();
        const limited =
          parsedLimitRegions?.ok === true ? Option.some(parsedLimitRegions.values) : Option.none();
        const serviceList = parsedServices.ok ? parsedServices.values : undefined;

        yield* __inner(
          generateInitInventoryEffect(
            id,
            mode,
            format,
            Option.getOrUndefined(Option.orElse(regions, () => limited)),
            debug,
            {
              skipGlobal,
              onlyGlobal,
              services: serviceList,
              incremental,
              minIntervalMinutes: Option.getOrUndefined(minInterval),
            },
          ).pipe(Effect.ensuring(Effect.sync(() => progress.stop()))),
        );
      });

      yield* _(runWithSdk.pipe(Effect.provide(SdkLive)));
    }),
).pipe(Command.withDescription("Generate cross-region inventory scan"));
