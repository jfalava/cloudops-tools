import { Database, type SQLQueryBindings } from "bun:sqlite";
import { Context, Effect, Layer } from "effect";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface InventoryRun {
  readonly id: number;
  readonly accountId: string;
  readonly timestamp: string;
  readonly runAt: string;
  readonly mode: string;
  readonly totalResources: number;
}

export interface ResourceRecord {
  readonly id: number;
  readonly runId: number;
  readonly type: string;
  readonly name: string;
  readonly region: string;
  readonly arn: string;
  readonly state: string | null;
  readonly tags: string | null;
  readonly createdDate: string | null;
  readonly publicAccess: string | null;
  readonly size: string | null;
  readonly encrypted: string | null;
  readonly vpcId: string | null;
  readonly lastActivity: string | null;
  readonly versionStatus: string | null;
}

export interface ResourceChange {
  readonly type: string;
  readonly name: string;
  readonly region: string;
  readonly change: "added" | "removed" | "modified";
  readonly oldValue: string | null;
  readonly newValue: string | null;
}

export interface InventoryDbService {
  readonly initialize: () => Effect.Effect<void, unknown>;
  readonly saveRun: (
    accountId: string,
    mode: string,
    resources: Array<{
      readonly type: string;
      readonly name: string;
      readonly region: string;
      readonly arn: string;
      readonly state?: string;
      readonly tags?: string;
      readonly createdDate?: string;
      readonly publicAccess?: string;
      readonly size?: string;
      readonly encrypted?: string;
      readonly vpcId?: string;
      readonly lastActivity?: string;
      readonly versionStatus?: string;
    }>,
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
    options: {
      readonly type?: string;
      readonly region?: string;
      readonly days?: number;
      readonly from?: string;
      readonly to?: string;
    },
  ) => Effect.Effect<
    Array<{ readonly runAt: string; readonly resources: ResourceRecord[] }>,
    unknown
  >;
  readonly getChanges: (
    accountId: string,
    days?: number,
  ) => Effect.Effect<ResourceChange[], unknown>;
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

  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_run_id ON resources(run_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_region ON resources(region)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_runs_account ON inventory_runs(account_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON inventory_runs(timestamp)`);
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

    close: () =>
      Effect.sync(() => {
        db.close();
      }),
  });
});
