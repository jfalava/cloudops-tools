import { generateInitInventoryEffect, SdkLive, UtilService } from "@cloudops-tools/sdk";
import { Command } from "@effect/cli";
import { Effect, Option } from "effect";

import { requireLetmeActivation } from "@/lib/letme";
import {
  account,
  initRegions,
  limitRegions,
  exportFormat,
  debugOption,
  skipGlobalOption,
  onlyGlobalOption,
  modeOption,
  servicesOption,
  useLetmeOption,
} from "@/options";
import { startProgressRenderer } from "@/progress";

export const initCommand = Command.make(
  "init",
  {
    account,
    region: initRegions,
    limitRegions,
    format: exportFormat,
    debug: debugOption,
    skipGlobal: skipGlobalOption,
    onlyGlobal: onlyGlobalOption,
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

      const runWithSdk = Effect.gen(function* (_) {
        const progress = yield* _(Effect.sync(() => startProgressRenderer({ debug })));
        const util = yield* _(UtilService);
        const id = yield* _(
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

        yield* generateInitInventoryEffect(
          id,
          mode,
          format,
          Option.getOrUndefined(Option.orElse(regions, () => limited)),
          debug,
          {
            skipGlobal,
            onlyGlobal,
            services: serviceList,
          },
        ).pipe(Effect.ensuring(Effect.sync(() => progress.stop())));
      });

      yield* _(runWithSdk.pipe(Effect.provide(SdkLive)));
    }),
).pipe(Command.withDescription("Generate cross-region inventory scan"));
