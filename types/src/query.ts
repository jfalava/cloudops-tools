import type { ResourceRecord } from "./inventory.js";

/**
 * Filters applied when querying historical inventory snapshots from the local database.
 */
export interface QueryOptions {
  /** Resource type filter (for example, EC2, RDS, Lambda). */
  readonly type?: string;
  /** AWS region filter. */
  readonly region?: string;
  /** Relative lookback window in days. */
  readonly days?: number;
  /** Inclusive ISO date lower bound (`YYYY-MM-DD`). */
  readonly from?: string;
  /** Inclusive ISO date upper bound (`YYYY-MM-DD`). */
  readonly to?: string;
}

/**
 * One inventory query result grouped by the run timestamp it came from.
 */
export interface QueryResult {
  /** Inventory run timestamp (`runAt`) for the returned resource batch. */
  readonly runAt: string;
  /** Resources captured in that run after applying query filters. */
  readonly resources: ResourceRecord[];
}
