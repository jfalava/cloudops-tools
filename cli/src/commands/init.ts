import { generateInitInventoryEffect, SdkLive, UtilService } from "@cloudops-tools/sdk";
import { Command } from "@effect/cli";
import { Effect, Option } from "effect";

import { requireLetmeActivation } from "@/lib/letme";
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
        const regions = Option.map(region, (r: string) => r.split(",").map((s) => s.trim()));
        const limited = Option.map(limitRegions, (r: string) => r.split(",").map((s) => s.trim()));
        const serviceList = Option.match(services, {
          onNone: () => undefined,
          onSome: (s: string) =>
            s.toLowerCase() === "all" ? undefined : s.split(",").map((svc) => svc.trim()),
        });

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
