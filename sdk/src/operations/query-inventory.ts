import type { QueryOptions, QueryResult } from "@cloudops-tools/types/query";
import { Effect } from "effect";

import { InventoryDbService, type InventoryRun, type ResourceChange } from "../lib/inventory-db";
export type { QueryOptions, QueryResult } from "@cloudops-tools/types/query";

/**
 * Query historical inventory resources for an account from the local SQLite inventory database.
 *
 * @param accountId Account identifier used as the query partition key.
 * @param options Optional filters for resource type, region, or date range.
 * @returns Effect that initializes the DB service and returns matching resources grouped by run.
 */
export const queryInventoryEffect = (
  accountId: string,
  options: QueryOptions = {},
): Effect.Effect<QueryResult[], unknown, InventoryDbService> =>
  Effect.gen(function* (_) {
    const db = yield* _(InventoryDbService);
    yield* _(db.initialize());
    return yield* _(db.queryResources(accountId, options));
  });

/**
 * Compute resource changes for an account over the last N days from the local inventory database.
 *
 * @param accountId Account identifier used to scope the diff query.
 * @param days Number of days to compare when calculating changes. Defaults to `7`.
 * @returns Effect that initializes the DB service and returns added/removed/modified resources.
 */
export const getInventoryChangesEffect = (
  accountId: string,
  days: number = 7,
): Effect.Effect<ResourceChange[], unknown, InventoryDbService> =>
  Effect.gen(function* (_) {
    const db = yield* _(InventoryDbService);
    yield* _(db.initialize());
    return yield* _(db.getChanges(accountId, days));
  });

/**
 * List recent inventory runs for an account from the local inventory database.
 *
 * @param accountId Account identifier used to scope the run history.
 * @param limit Maximum number of runs to return. Defaults to `30`.
 * @returns Effect that initializes the DB service and returns run metadata rows.
 */
export const listInventoryRunsEffect = (
  accountId: string,
  limit: number = 30,
): Effect.Effect<InventoryRun[], unknown, InventoryDbService> =>
  Effect.gen(function* (_) {
    const db = yield* _(InventoryDbService);
    yield* _(db.initialize());
    return yield* _(db.getRuns(accountId, limit));
  });
