import { generateInitInventoryEffect, SdkLive, UtilService } from "@cloudops-tools/sdk";
import { Command } from "@effect/cli";
import { Effect, Option } from "effect";

import { requireLetmeActivation } from "@/lib/letme";
import {
  parseCsvValues,
  parseServicesOption,
  type ParseOptionResult,
} from "@/lib/option-validation";
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

type ParsedServicesOption = ParseOptionResult<string[] | undefined>;
type ValidatedRegionSelections = {
  readonly parsedRegions: Option.Option<string[]>;
  readonly parsedLimitRegions: Option.Option<string[]>;
};

const validateInitArguments = (
  skipGlobal: boolean,
  onlyGlobal: boolean,
  region: Option.Option<string>,
  limitRegions: Option.Option<string>,
  minInterval: Option.Option<number>,
) =>
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
  });

const parseInitRegionSelections = (
  region: Option.Option<string>,
  limitRegions: Option.Option<string>,
) =>
  Effect.gen(function* (_) {
    const parsedRegions = Option.match(region, {
      onNone: () => undefined,
      onSome: (raw: string) =>
        parseCsvValues("--region", raw, "cloudops-tools init --region us-east-1,us-west-2"),
    });
    if (parsedRegions && !parsedRegions.ok) {
      return yield* _(Effect.fail(parsedRegions.error));
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
      return yield* _(Effect.fail(parsedLimitRegions.error));
    }

    return {
      parsedRegions: parsedRegions?.ok === true ? Option.some(parsedRegions.values) : Option.none(),
      parsedLimitRegions:
        parsedLimitRegions?.ok === true ? Option.some(parsedLimitRegions.values) : Option.none(),
    } satisfies ValidatedRegionSelections;
  });

const parseInitServicesSelection = (services: Option.Option<string>): ParsedServicesOption =>
  Option.match(services, {
    onNone: () => ({ ok: true as const, values: undefined }),
    onSome: (raw: string) =>
      parseServicesOption(raw, {
        list: "cloudops-tools init --services EC2,RDS,S3 --region us-east-1",
        all: "cloudops-tools init --services all",
      }),
  });

const runInitWithSdk = ({
  account,
  mode,
  format,
  debug,
  skipGlobal,
  onlyGlobal,
  incremental,
  minInterval,
  parsedRegions,
  parsedLimitRegions,
  parsedServices,
}: {
  readonly account: Option.Option<string>;
  readonly mode: Parameters<typeof generateInitInventoryEffect>[1];
  readonly format: Parameters<typeof generateInitInventoryEffect>[2];
  readonly debug: boolean;
  readonly skipGlobal: boolean;
  readonly onlyGlobal: boolean;
  readonly incremental: boolean;
  readonly minInterval: Option.Option<number>;
  readonly parsedRegions: Option.Option<string[]>;
  readonly parsedLimitRegions: Option.Option<string[]>;
  readonly parsedServices: ParsedServicesOption;
}) =>
  Effect.gen(function* (_) {
    const progress = yield* _(Effect.sync(() => startProgressRenderer({ debug })));
    const util = yield* _(UtilService);
    const id = yield* _(
      Option.match(account, {
        onNone: () => util.getAccountId(),
        onSome: (value) => Effect.succeed(value),
      }),
    );
    const serviceList = parsedServices.ok ? parsedServices.values : undefined;

    yield* _(
      generateInitInventoryEffect(
        id,
        mode,
        format,
        Option.getOrUndefined(Option.orElse(parsedRegions, () => parsedLimitRegions)),
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
      yield* _(validateInitArguments(skipGlobal, onlyGlobal, region, limitRegions, minInterval));

      const { parsedRegions, parsedLimitRegions } = yield* _(
        parseInitRegionSelections(region, limitRegions),
      );

      const parsedServices = parseInitServicesSelection(services);
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

      yield* _(
        runInitWithSdk({
          account,
          mode,
          format,
          debug,
          skipGlobal,
          onlyGlobal,
          incremental,
          minInterval,
          parsedRegions,
          parsedLimitRegions,
          parsedServices,
        }).pipe(Effect.provide(SdkLive)),
      );
    }),
).pipe(Command.withDescription("Generate cross-region inventory scan"));
