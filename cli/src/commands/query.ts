import {
  queryInventoryEffect,
  getInventoryChangesEffect,
  listInventoryRunsEffect,
} from "@cloudops-tools/sdk";
import { Command, Options } from "@effect/cli";
import { Effect, Console, Option } from "effect";

import { invalidUserInput } from "@/lib/user-input-error";
import { account as accountOption } from "@/options";
import { ui } from "@/ui";

const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseIsoDateOnlyUtc = (value: string): Date | null => {
  if (!ISO_DATE_ONLY_PATTERN.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10) === value ? parsed : null;
};

const invalidQueryParams = (message: string, example?: string) =>
  invalidUserInput(message, { example });

const queryType = Options.optional(Options.text("type")).pipe(
  Options.withAlias("t"),
  Options.withDescription("Filter by resource type (e.g., EC2, RDS, Lambda)"),
);

const queryRegion = Options.optional(Options.text("region")).pipe(
  Options.withAlias("r"),
  Options.withDescription("Filter by region"),
);

const queryDays = Options.optional(Options.integer("days")).pipe(
  Options.withAlias("d"),
  Options.withDescription("Query resources from the last N days"),
);

const queryFrom = Options.optional(Options.text("from")).pipe(
  Options.withDescription("Query from date (ISO format: YYYY-MM-DD)"),
);

const queryTo = Options.optional(Options.text("to")).pipe(
  Options.withDescription("Query to date (ISO format: YYYY-MM-DD)"),
);

const queryLimit = Options.withDefault(Options.integer("limit"), 10).pipe(
  Options.withAlias("l"),
  Options.withDescription("Limit number of runs to display"),
);

const queryChanges = Options.boolean("changes").pipe(
  Options.withAlias("c"),
  Options.withDescription("Show changes since last run"),
);

const queryChangesDays = Options.withDefault(Options.integer("changes-days"), 7).pipe(
  Options.withDescription("Number of days to compare for changes (default: 7)"),
);

const queryRuns = Options.boolean("runs").pipe(Options.withDescription("List all inventory runs"));

const formatResourceRow = (r: {
  readonly type: string;
  readonly name: string;
  readonly region: string;
  readonly state: string | null;
}): string => {
  const state = r.state ?? "N/A";
  return `${r.type.padEnd(18)} ${r.name.padEnd(40)} ${r.region.padEnd(16)} ${state}`;
};

const displayRuns = (
  runList: Array<{
    readonly id: number;
    readonly timestamp: string;
    readonly runAt: string;
    readonly mode: string;
    readonly totalResources: number;
  }>,
) =>
  Effect.gen(function* (_) {
    if (runList.length === 0) {
      yield* _(Console.log(ui.info("No inventory runs found")));
      return;
    }

    yield* _(Console.log(ui.info(`Found ${runList.length} inventory run(s):\n`)));
    yield* _(
      Console.log(
        "ID".padEnd(8) +
          "Timestamp".padEnd(12) +
          "Run At".padEnd(24) +
          "Mode".padEnd(12) +
          "Resources",
      ),
    );
    yield* _(Console.log("-".repeat(70)));

    for (const run of runList) {
      const runAtShort = run.runAt.slice(0, 19);
      yield* _(
        Console.log(
          String(run.id).padEnd(8) +
            run.timestamp.padEnd(12) +
            runAtShort.padEnd(24) +
            run.mode.padEnd(12) +
            String(run.totalResources),
        ),
      );
    }
  });

const displayChanges = (
  changesList: Array<{
    readonly type: string;
    readonly name: string;
    readonly region: string;
    readonly change: "added" | "removed" | "modified";
    readonly oldValue: string | null;
    readonly newValue: string | null;
  }>,
  days: number,
) =>
  Effect.gen(function* (_) {
    if (changesList.length === 0) {
      yield* _(Console.log(ui.info(`No changes detected in the last ${days} day(s)`)));
      return;
    }

    const added = changesList.filter((c) => c.change === "added");
    const removed = changesList.filter((c) => c.change === "removed");
    const modified = changesList.filter((c) => c.change === "modified");

    yield* _(Console.log(ui.info(`\nChanges detected (${days} day(s)):\n`)));

    if (added.length > 0) {
      yield* _(Console.log(ui.success(`Added (${added.length}):`)));
      for (const c of added.slice(0, 20)) {
        yield* _(Console.log(`  + ${c.type}/${c.name} (${c.region})`));
      }
      if (added.length > 20) {
        yield* _(Console.log(ui.info(`  ... and ${added.length - 20} more`)));
      }
      yield* _(Console.log(""));
    }

    if (removed.length > 0) {
      yield* _(Console.log(ui.error(`Removed (${removed.length}):`)));
      for (const c of removed.slice(0, 20)) {
        yield* _(Console.log(`  - ${c.type}/${c.name} (${c.region})`));
      }
      if (removed.length > 20) {
        yield* _(Console.log(ui.info(`  ... and ${removed.length - 20} more`)));
      }
      yield* _(Console.log(""));
    }

    if (modified.length > 0) {
      yield* _(Console.log(ui.info(`Modified (${modified.length}):`)));
      for (const c of modified.slice(0, 20)) {
        yield* _(
          Console.log(`  ~ ${c.type}/${c.name} (${c.region}): ${c.oldValue} -> ${c.newValue}`),
        );
      }
      if (modified.length > 20) {
        yield* _(Console.log(ui.info(`  ... and ${modified.length - 20} more`)));
      }
    }
  });

const displayResources = (
  results: Array<{
    readonly runAt: string;
    readonly resources: Array<{
      readonly type: string;
      readonly name: string;
      readonly region: string;
      readonly state: string | null;
      readonly arn: string;
    }>;
  }>,
) =>
  Effect.gen(function* (_) {
    if (results.length === 0) {
      yield* _(Console.log(ui.info("No resources found matching the criteria")));
      return;
    }

    const totalResources = results.reduce((sum, r) => sum + r.resources.length, 0);
    yield* _(
      Console.log(ui.info(`\nFound ${totalResources} resource(s) in ${results.length} run(s):\n`)),
    );
    yield* _(Console.log("Type".padEnd(18) + "Name".padEnd(40) + "Region".padEnd(16) + "State"));
    yield* _(Console.log("-".repeat(90)));

    for (const result of results) {
      yield* _(Console.log(ui.info(`\nRun: ${result.runAt}`)));
      for (const resource of result.resources.slice(0, 100)) {
        yield* _(Console.log(formatResourceRow(resource)));
      }
      if (result.resources.length > 100) {
        yield* _(Console.log(ui.info(`  ... and ${result.resources.length - 100} more`)));
      }
    }
  });

export const queryCommand = Command.make(
  "query",
  {
    account: accountOption,
    type: queryType,
    region: queryRegion,
    days: queryDays,
    from: queryFrom,
    to: queryTo,
    limit: queryLimit,
    changes: queryChanges,
    changesDays: queryChangesDays,
    runs: queryRuns,
  },
  ({ account, type, region, days, from, to, limit, changes, changesDays, runs }) =>
    Effect.gen(function* (_) {
      if (runs && changes) {
        yield* _(
          Effect.fail(
            invalidQueryParams(
              "Invalid option combination: --runs cannot be used with --changes.",
              "cloudops-tools query --runs --limit 20",
            ),
          ),
        );
      }

      if (limit <= 0) {
        yield* _(
          Effect.fail(
            invalidQueryParams(
              `Invalid value for --limit: ${String(limit)}. Expected a positive integer.`,
              "cloudops-tools query --runs --limit 10",
            ),
          ),
        );
      }

      if (changesDays <= 0) {
        yield* _(
          Effect.fail(
            invalidQueryParams(
              `Invalid value for --changes-days: ${String(changesDays)}. Expected a positive integer.`,
              "cloudops-tools query --changes --changes-days 7",
            ),
          ),
        );
      }

      if (Option.isSome(days) && days.value <= 0) {
        yield* _(
          Effect.fail(
            invalidQueryParams(
              `Invalid value for --days: ${String(days.value)}. Expected a positive integer.`,
              "cloudops-tools query --days 14",
            ),
          ),
        );
      }

      const fromValue = Option.getOrUndefined(from);
      const toValue = Option.getOrUndefined(to);
      const parsedFrom = fromValue ? parseIsoDateOnlyUtc(fromValue) : null;
      const parsedTo = toValue ? parseIsoDateOnlyUtc(toValue) : null;

      if (fromValue && parsedFrom === null) {
        yield* _(
          Effect.fail(
            invalidQueryParams(
              `Invalid value for --from: "${fromValue}". Expected ISO date format YYYY-MM-DD.`,
              "cloudops-tools query --from 2026-02-01 --to 2026-02-15",
            ),
          ),
        );
      }

      if (toValue && parsedTo === null) {
        yield* _(
          Effect.fail(
            invalidQueryParams(
              `Invalid value for --to: "${toValue}". Expected ISO date format YYYY-MM-DD.`,
              "cloudops-tools query --from 2026-02-01 --to 2026-02-15",
            ),
          ),
        );
      }

      if (parsedFrom && parsedTo && parsedFrom.getTime() > parsedTo.getTime()) {
        yield* _(
          Effect.fail(
            invalidQueryParams(
              `Invalid date range: --from (${fromValue}) must be on or before --to (${toValue}).`,
              "cloudops-tools query --from 2026-02-01 --to 2026-02-15",
            ),
          ),
        );
      }

      const accountId = Option.getOrElse(account, () => "default");

      if (runs) {
        const runList = yield* _(listInventoryRunsEffect(accountId, limit));
        yield* _(displayRuns(runList));
        return;
      }

      if (changes) {
        const changesList = yield* _(getInventoryChangesEffect(accountId, changesDays));
        yield* _(displayChanges(changesList, changesDays));
        return;
      }

      const results = yield* _(
        queryInventoryEffect(accountId, {
          type: Option.getOrUndefined(type),
          region: Option.getOrUndefined(region),
          days: Option.getOrUndefined(days),
          from: fromValue,
          to: toValue,
        }),
      );

      yield* _(displayResources(results));
    }),
).pipe(Command.withDescription("Query historical inventory data from local SQLite database"));
