import { Database, type SQLQueryBindings } from "bun:sqlite";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import type {
  DescribeCacheEntry,
  IncrementalResult,
  InventoryResource,
  InventoryRun,
  ResourceChange,
  ResourceRecord,
  ScanDedupResult,
} from "@cloudops-tools/types/inventory";
import type { QueryOptions, QueryResult } from "@cloudops-tools/types/query";
import { Context, Effect, Layer } from "effect";

export type {
  DescribeCacheEntry,
  IncrementalResult,
  InventoryResource,
  InventoryRun,
  ResourceChange,
  ResourceRecord,
  ScanDedupResult,
} from "@cloudops-tools/types/inventory";

export interface InventoryDbService {
  readonly initialize: () => Effect.Effect<void, unknown>;
  readonly saveRun: (
    accountId: string,
    mode: string,
    resources: InventoryResource[],
  ) => Effect.Effect<number, unknown>;
  readonly getRuns: (accountId: string, limit?: number) => Effect.Effect<InventoryRun[], unknown>;
  readonly getResources: (
    runId: number,
    filters?: {
      readonly type?: string;
      readonly region?: string;
    },
  ) => Effect.Effect<ResourceRecord[], unknown>;
  readonly queryResources: (
    accountId: string,
    options: QueryOptions,
  ) => Effect.Effect<QueryResult[], unknown>;
  readonly getChanges: (
    accountId: string,
    days?: number,
  ) => Effect.Effect<ResourceChange[], unknown>;
  readonly getIncrementalChanges: (
    accountId: string,
    resources: InventoryResource[],
  ) => Effect.Effect<IncrementalResult, unknown>;
  readonly updateFingerprints: (
    accountId: string,
    resources: InventoryResource[],
  ) => Effect.Effect<void, unknown>;
  readonly getDescribeCache: (
    resourceType: string,
    region: string,
  ) => Effect.Effect<DescribeCacheEntry | null, unknown>;
  readonly setDescribeCache: (
    resourceType: string,
    region: string,
    data: ReadonlyArray<Record<string, unknown>>,
    ttlSeconds?: number,
  ) => Effect.Effect<void, unknown>;
  readonly checkRecentScan: (
    accountId: string,
    mode: string,
    minIntervalMinutes: number,
  ) => Effect.Effect<ScanDedupResult, unknown>;
  readonly close: () => Effect.Effect<void, unknown>;
}

export const InventoryDbService = Context.GenericTag<InventoryDbService>(
  "@sdk/lib/InventoryDbService",
);

const getDbPath = (): string => {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    throw new Error("Could not determine home directory");
  }
  const configDir = join(home, ".config", "cloudops-tools");
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  return join(configDir, "inventory.db");
};

const createSchema = (db: Database): void => {
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      run_at TEXT NOT NULL,
      mode TEXT NOT NULL,
      total_resources INTEGER NOT NULL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      region TEXT NOT NULL,
      arn TEXT NOT NULL,
      state TEXT,
      tags TEXT,
      created_date TEXT,
      public_access TEXT,
      size TEXT,
      encrypted TEXT,
      vpc_id TEXT,
      last_activity TEXT,
      version_status TEXT,
      FOREIGN KEY (run_id) REFERENCES inventory_runs(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS resource_fingerprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      arn TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(account_id, arn)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_run_id ON resources(run_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_region ON resources(region)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_runs_account ON inventory_runs(account_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON inventory_runs(timestamp)`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_fingerprints_account ON resource_fingerprints(account_id)`,
  );
  db.run(`CREATE INDEX IF NOT EXISTS idx_fingerprints_arn ON resource_fingerprints(arn)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS describe_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_type TEXT NOT NULL,
      region TEXT NOT NULL,
      data TEXT NOT NULL,
      cached_at TEXT NOT NULL,
      ttl_seconds INTEGER NOT NULL DEFAULT 300,
      UNIQUE(resource_type, region)
    )
  `);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_describe_cache_type_region ON describe_cache(resource_type, region)`,
  );
};

interface RunRow {
  id: number;
  account_id: string;
  timestamp: string;
  run_at: string;
  mode: string;
  total_resources: number;
}

interface ResourceRow {
  id: number;
  run_id: number;
  type: string;
  name: string;
  region: string;
  arn: string;
  state: string | null;
  tags: string | null;
  created_date: string | null;
  public_access: string | null;
  size: string | null;
  encrypted: string | null;
  vpc_id: string | null;
  last_activity: string | null;
  version_status: string | null;
  run_at?: string;
}

const mapRunRow = (row: RunRow): InventoryRun => ({
  id: row.id,
  accountId: row.account_id,
  timestamp: row.timestamp,
  runAt: row.run_at,
  mode: row.mode,
  totalResources: row.total_resources,
});

const mapResourceRow = (row: ResourceRow): ResourceRecord => ({
  id: row.id,
  runId: row.run_id,
  type: row.type,
  name: row.name,
  region: row.region,
  arn: row.arn,
  state: row.state,
  tags: row.tags,
  createdDate: row.created_date,
  publicAccess: row.public_access,
  size: row.size,
  encrypted: row.encrypted,
  vpcId: row.vpc_id,
  lastActivity: row.last_activity,
  versionStatus: row.version_status,
});

export const InventoryDbServiceLive = Layer.sync(InventoryDbService, () => {
  const dbPath = getDbPath();
  const db = new Database(dbPath);
  let initialized = false;

  return InventoryDbService.of({
    initialize: () =>
      Effect.sync(() => {
        if (!initialized) {
          createSchema(db);
          initialized = true;
        }
      }),

    saveRun: (accountId, mode, resources) =>
      Effect.sync(() => {
        if (!initialized) {
          createSchema(db);
          initialized = true;
        }

        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const runAt = new Date().toISOString();

        const insertRun = db.prepare(`
            INSERT INTO inventory_runs (account_id, timestamp, run_at, mode, total_resources)
            VALUES ($accountId, $timestamp, $runAt, $mode, $totalResources)
          `);

        const insertResource = db.prepare(`
            INSERT INTO resources (run_id, type, name, region, arn, state, tags, created_date, public_access, size, encrypted, vpc_id, last_activity, version_status)
            VALUES ($runId, $type, $name, $region, $arn, $state, $tags, $createdDate, $publicAccess, $size, $encrypted, $vpcId, $lastActivity, $versionStatus)
          `);

        const runResult = insertRun.run({
          $accountId: accountId,
          $timestamp: timestamp,
          $runAt: runAt,
          $mode: mode,
          $totalResources: resources.length,
        } as SQLQueryBindings);

        const runId = Number(runResult.lastInsertRowid);

        const insertMany = db.transaction((items: Array<{ [key: string]: unknown }>) => {
          for (const item of items) {
            insertResource.run(item as SQLQueryBindings);
          }
        });

        const resourceRecords = resources.map((r) => ({
          $runId: runId,
          $type: r.type,
          $name: r.name,
          $region: r.region,
          $arn: r.arn,
          $state: r.state ?? null,
          $tags: r.tags ?? null,
          $createdDate: r.createdDate ?? null,
          $publicAccess: r.publicAccess ?? null,
          $size: r.size ?? null,
          $encrypted: r.encrypted ?? null,
          $vpcId: r.vpcId ?? null,
          $lastActivity: r.lastActivity ?? null,
          $versionStatus: r.versionStatus ?? null,
        }));

        insertMany(resourceRecords);

        return runId;
      }),

    getRuns: (accountId, limit = 30) =>
      Effect.sync(() => {
        const query = db.prepare(`
            SELECT id, account_id, timestamp, run_at, mode, total_resources
            FROM inventory_runs
            WHERE account_id = $accountId
            ORDER BY run_at DESC
            LIMIT $limit
          `);

        const rows = query.all({
          $accountId: accountId,
          $limit: limit,
        } as SQLQueryBindings) as RunRow[];

        return rows.map(mapRunRow);
      }),

    getResources: (runId, filters) =>
      Effect.sync(() => {
        let sql = `
            SELECT id, run_id, type, name, region, arn, state, tags, created_date, public_access, size, encrypted, vpc_id, last_activity, version_status
            FROM resources
            WHERE run_id = $runId
          `;

        const params: { [key: string]: unknown } = { $runId: runId };

        if (filters?.type) {
          sql += " AND type = $type";
          params.$type = filters.type;
        }

        if (filters?.region) {
          sql += " AND region = $region";
          params.$region = filters.region;
        }

        const query = db.prepare(sql);
        const rows = query.all(params as SQLQueryBindings) as ResourceRow[];

        return rows.map(mapResourceRow);
      }),

    queryResources: (accountId, options) =>
      Effect.sync(() => {
        if (!initialized) {
          createSchema(db);
          initialized = true;
        }

        let sql = `
            SELECT r.id, r.run_id, r.type, r.name, r.region, r.arn, r.state, r.tags,
                   r.created_date, r.public_access, r.size, r.encrypted, r.vpc_id,
                   r.last_activity, r.version_status, ir.run_at
            FROM resources r
            JOIN inventory_runs ir ON r.run_id = ir.id
            WHERE ir.account_id = $accountId
          `;

        const params: { [key: string]: unknown } = { $accountId: accountId };

        if (options.type) {
          sql += " AND r.type = $type";
          params.$type = options.type;
        }

        if (options.region) {
          sql += " AND r.region = $region";
          params.$region = options.region;
        }

        if (options.days) {
          sql += " AND ir.run_at >= datetime('now', '-' || $days || ' days')";
          params.$days = options.days;
        }

        if (options.from) {
          sql += " AND ir.run_at >= $from";
          params.$from = options.from;
        }

        if (options.to) {
          sql += " AND ir.run_at <= $to";
          params.$to = options.to;
        }

        sql += " ORDER BY ir.run_at DESC, r.type, r.name";

        const query = db.prepare(sql);
        const rows = query.all(params as SQLQueryBindings) as Array<
          ResourceRow & { run_at: string }
        >;

        const grouped = new Map<string, ResourceRecord[]>();

        for (const row of rows) {
          const record = mapResourceRow(row);
          const existing = grouped.get(row.run_at) ?? [];
          existing.push(record);
          grouped.set(row.run_at, existing);
        }

        return Array.from(grouped.entries()).map(([runAt, resources]) => ({
          runAt,
          resources,
        }));
      }),

    getChanges: (accountId, days = 7) =>
      Effect.sync(() => {
        if (!initialized) {
          createSchema(db);
          initialized = true;
        }

        const runsQuery = db.prepare(`
            SELECT id, run_at
            FROM inventory_runs
            WHERE account_id = $accountId
            AND run_at >= datetime('now', '-' || $days || ' days')
            ORDER BY run_at DESC
            LIMIT 2
          `);

        const runs = runsQuery.all({
          $accountId: accountId,
          $days: days,
        } as SQLQueryBindings) as Array<{ id: number; run_at: string }>;

        if (runs.length < 2) {
          return [];
        }

        const currentRun = runs[0];
        const previousRun = runs[1];

        if (!currentRun || !previousRun) {
          return [];
        }

        const getResourcesForRun = (runId: number): Map<string, ResourceRecord> => {
          const query = db.prepare(`
              SELECT id, run_id, type, name, region, arn, state, tags, created_date,
                     public_access, size, encrypted, vpc_id, last_activity, version_status
              FROM resources
              WHERE run_id = $runId
            `);

          const rows = query.all({ $runId: runId } as SQLQueryBindings) as ResourceRow[];

          const map = new Map<string, ResourceRecord>();
          for (const row of rows) {
            const record = mapResourceRow(row);
            map.set(row.arn, record);
          }
          return map;
        };

        const currentResources = getResourcesForRun(currentRun.id);
        const previousResources = getResourcesForRun(previousRun.id);

        const changes: ResourceChange[] = [];

        for (const [arn, resource] of currentResources) {
          const prevResource = previousResources.get(arn);
          if (!prevResource) {
            changes.push({
              type: resource.type,
              name: resource.name,
              region: resource.region,
              change: "added",
              oldValue: null,
              newValue: resource.state ?? null,
            });
          } else if (resource.state !== prevResource.state) {
            changes.push({
              type: resource.type,
              name: resource.name,
              region: resource.region,
              change: "modified",
              oldValue: prevResource.state ?? null,
              newValue: resource.state ?? null,
            });
          }
        }

        for (const [arn, resource] of previousResources) {
          if (!currentResources.has(arn)) {
            changes.push({
              type: resource.type,
              name: resource.name,
              region: resource.region,
              change: "removed",
              oldValue: resource.state ?? null,
              newValue: null,
            });
          }
        }

        return changes;
      }),

    getIncrementalChanges: (accountId, resources) =>
      Effect.sync(() => {
        if (!initialized) {
          createSchema(db);
          initialized = true;
        }

        const computeFingerprint = (r: (typeof resources)[number]): string => {
          const data = JSON.stringify({
            type: r.type,
            name: r.name,
            region: r.region,
            state: r.state,
            size: r.size,
            encrypted: r.encrypted,
            publicAccess: r.publicAccess,
          });
          return createHash("sha256").update(data).digest("hex");
        };

        const currentFingerprints = new Map<string, string>();
        for (const r of resources) {
          currentFingerprints.set(r.arn, computeFingerprint(r));
        }

        const query = db.prepare(`
          SELECT arn, fingerprint FROM resource_fingerprints WHERE account_id = $accountId
        `);

        const rows = query.all({ $accountId: accountId } as SQLQueryBindings) as Array<{
          arn: string;
          fingerprint: string;
        }>;

        const previousFingerprints = new Map<string, string>();
        for (const row of rows) {
          previousFingerprints.set(row.arn, row.fingerprint);
        }

        const newResources: (typeof resources)[number][] = [];
        const changedResources: (typeof resources)[number][] = [];
        let unchangedCount = 0;

        for (const r of resources) {
          const currentFp = currentFingerprints.get(r.arn);
          const prevFp = previousFingerprints.get(r.arn);

          if (!prevFp) {
            newResources.push(r);
          } else if (currentFp !== prevFp) {
            changedResources.push(r);
          } else {
            unchangedCount += 1;
          }
        }

        let removedCount = 0;
        for (const arn of previousFingerprints.keys()) {
          if (!currentFingerprints.has(arn)) {
            removedCount += 1;
          }
        }

        return {
          newResources,
          changedResources,
          unchangedCount,
          removedCount,
        };
      }),

    updateFingerprints: (accountId, resources) =>
      Effect.sync(() => {
        if (!initialized) {
          createSchema(db);
          initialized = true;
        }

        const computeFingerprint = (r: (typeof resources)[number]): string => {
          const data = JSON.stringify({
            type: r.type,
            name: r.name,
            region: r.region,
            state: r.state,
            size: r.size,
            encrypted: r.encrypted,
            publicAccess: r.publicAccess,
          });
          return createHash("sha256").update(data).digest("hex");
        };

        const updatedAt = new Date().toISOString();

        const insertFingerprint = db.prepare(`
          INSERT INTO resource_fingerprints (account_id, arn, fingerprint, updated_at)
          VALUES ($accountId, $arn, $fingerprint, $updatedAt)
          ON CONFLICT(account_id, arn) DO UPDATE SET
            fingerprint = excluded.fingerprint,
            updated_at = excluded.updated_at
        `);

        const insertMany = db.transaction((items: Array<{ [key: string]: unknown }>) => {
          for (const item of items) {
            insertFingerprint.run(item as SQLQueryBindings);
          }
        });

        const records = resources.map((r) => ({
          $accountId: accountId,
          $arn: r.arn,
          $fingerprint: computeFingerprint(r),
          $updatedAt: updatedAt,
        }));

        insertMany(records);
      }),

    getDescribeCache: (resourceType, region) =>
      Effect.sync(() => {
        if (!initialized) {
          createSchema(db);
          initialized = true;
        }

        const query = db.prepare(`
          SELECT id, resource_type, region, data, cached_at, ttl_seconds
          FROM describe_cache
          WHERE resource_type = $resourceType AND region = $region
        `);

        const row = query.get({
          $resourceType: resourceType.toUpperCase(),
          $region: region,
        } as SQLQueryBindings) as
          | {
              id: number;
              resource_type: string;
              region: string;
              data: string;
              cached_at: string;
              ttl_seconds: number;
            }
          | undefined;

        if (!row) {
          return null;
        }

        const cachedAt = new Date(row.cached_at);
        const expiresAt = new Date(cachedAt.getTime() + row.ttl_seconds * 1000);
        if (new Date() > expiresAt) {
          return null;
        }

        return {
          id: row.id,
          resourceType: row.resource_type,
          region: row.region,
          data: row.data,
          cachedAt: row.cached_at,
          ttlSeconds: row.ttl_seconds,
        };
      }),

    setDescribeCache: (resourceType, region, data, ttlSeconds = 300) =>
      Effect.sync(() => {
        if (!initialized) {
          createSchema(db);
          initialized = true;
        }

        const cachedAt = new Date().toISOString();
        const dataJson = JSON.stringify(data);

        const insert = db.prepare(`
          INSERT INTO describe_cache (resource_type, region, data, cached_at, ttl_seconds)
          VALUES ($resourceType, $region, $data, $cachedAt, $ttlSeconds)
          ON CONFLICT(resource_type, region) DO UPDATE SET
            data = excluded.data,
            cached_at = excluded.cached_at,
            ttl_seconds = excluded.ttl_seconds
        `);

        insert.run({
          $resourceType: resourceType.toUpperCase(),
          $region: region,
          $data: dataJson,
          $cachedAt: cachedAt,
          $ttlSeconds: ttlSeconds,
        } as SQLQueryBindings);
      }),

    checkRecentScan: (accountId, mode, minIntervalMinutes) =>
      Effect.sync(() => {
        if (!initialized) {
          createSchema(db);
          initialized = true;
        }

        const query = db.prepare(`
          SELECT run_at
          FROM inventory_runs
          WHERE account_id = $accountId AND mode = $mode
          ORDER BY run_at DESC
          LIMIT 1
        `);

        const row = query.get({
          $accountId: accountId,
          $mode: mode,
        } as SQLQueryBindings) as { run_at: string } | undefined;

        if (!row) {
          return {
            shouldSkip: false,
            lastRunAt: null,
            minutesSinceLastRun: null,
          };
        }

        const lastRunAt = new Date(row.run_at);
        const now = new Date();
        const minutesSinceLastRun = (now.getTime() - lastRunAt.getTime()) / (1000 * 60);

        return {
          shouldSkip: minutesSinceLastRun < minIntervalMinutes,
          lastRunAt: row.run_at,
          minutesSinceLastRun,
        };
      }),

    close: () =>
      Effect.sync(() => {
        db.close();
      }),
  });
});
