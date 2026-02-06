import { generateInitInventoryEffect, UtilService } from "@cloudops-tools/sdk";
import { Command } from "@effect/cli";
import { Effect, Option } from "effect";

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
  },
  ({ account, region, limitRegions, format, mode, debug, skipGlobal, onlyGlobal, services }) =>
    Effect.gen(function* (_) {
      const progress = yield* Effect.sync(() => startProgressRenderer({ debug }));
      const util = yield* _(UtilService);
      const id = yield* _(
        Option.match(account, {
          onNone: () => util.getAccountId(),
          onSome: (value) => Effect.succeed(value),
        }),
      );
      const regions = Option.map(region, (r: string) => r.split(",").map((s) => s.trim()));
      const limited = Option.map(limitRegions, (r: string) => r.split(",").map((s) => s.trim()));
      const serviceList = Option.map(services, (s: string) =>
        s.toLowerCase() === "all" ? undefined : s.split(",").map((svc) => svc.trim()),
      );

      yield* generateInitInventoryEffect(
        id,
        mode,
        format,
        Option.getOrUndefined(Option.orElse(regions, () => limited)),
        debug,
        {
          skipGlobal,
          onlyGlobal,
          services: Option.getOrUndefined(serviceList),
        },
      ).pipe(Effect.ensuring(Effect.sync(() => progress.stop())));
    }),
).pipe(Command.withDescription("Generate cross-region inventory scan"));
