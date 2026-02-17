import { Effect } from "effect";

import { InventoryDbService, type ResourceRecord, type ResourceChange } from "../lib/inventory-db";

export interface QueryOptions {
  readonly type?: string;
  readonly region?: string;
  readonly days?: number;
  readonly from?: string;
  readonly to?: string;
}

export interface QueryResult {
  readonly runAt: string;
  readonly resources: ResourceRecord[];
}

export const queryInventoryEffect = (
  accountId: string,
  options: QueryOptions = {},
): Effect.Effect<QueryResult[], unknown, InventoryDbService> =>
  Effect.gen(function* (_) {
    const db = yield* _(InventoryDbService);
    yield* _(db.initialize());
    return yield* _(db.queryResources(accountId, options));
  });

export const getInventoryChangesEffect = (
  accountId: string,
  days: number = 7,
): Effect.Effect<ResourceChange[], unknown, InventoryDbService> =>
  Effect.gen(function* (_) {
    const db = yield* _(InventoryDbService);
    yield* _(db.initialize());
    return yield* _(db.getChanges(accountId, days));
  });

export const listInventoryRunsEffect = (
  accountId: string,
  limit: number = 30,
): Effect.Effect<
  Array<{
    readonly id: number;
    readonly accountId: string;
    readonly timestamp: string;
    readonly runAt: string;
    readonly mode: string;
    readonly totalResources: number;
  }>,
  unknown,
  InventoryDbService
> =>
  Effect.gen(function* (_) {
    const db = yield* _(InventoryDbService);
    yield* _(db.initialize());
    return yield* _(db.getRuns(accountId, limit));
  });
