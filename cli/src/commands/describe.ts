import { ReportingService, SdkLive } from "@cloudops-tools/sdk";
import { Command, Args } from "@effect/cli";
import { Effect, Console } from "effect";

import { debugOption } from "@/options";
import { ui } from "@/ui";

export const describeCommand = Command.make(
  "describe",
  {
    type: Args.text({ name: "type" }),
    region: Args.text({ name: "region" }),
    id: Args.text({ name: "id" }),
    debug: debugOption,
  },
  ({ type, region, id, debug }) =>
    Effect.gen(function* (_) {
      const reporting = yield* _(ReportingService);
      const report = yield* _(reporting.describeResourceHarder(type, region, id, debug));
      if (report.startsWith("Unsupported resource type")) {
        yield* _(Console.log(ui.error(report)));
        return;
      }
      if (report.startsWith("Resource not found")) {
        yield* _(Console.log(ui.warn(report)));
        return;
      }
      yield* _(Console.log(report));
    }).pipe(Effect.provide(SdkLive)),
).pipe(Command.withDescription("Deeply describe a specific resource (Outputs Markdown)"));
