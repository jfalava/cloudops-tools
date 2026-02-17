import { Database, type SQLQueryBindings } from "bun:sqlite";
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Effect, Layer } from "effect";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InventoryDbService, type ResourceRecord } from "../../../src/lib/inventory-db";
import {
  queryInventoryEffect,
  getInventoryChangesEffect,
  listInventoryRunsEffect,
} from "../../../src/operations/query-inventory";

const createTestDbService = (dbPath: string): InventoryDbService => {
  const db = new Database(dbPath);
  let initialized = false;

  const createSchema = (): void => {
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
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_fingerprints_account ON resource_fingerprints(account_id)`,
    );
  };

  return InventoryDbService.of({
    initialize: () =>
      Effect.sync(() => {
        if (!initialized) {
          createSchema();
          initialized = true;
        }
      }),

    saveRun: (accountId, mode, resources) =>
      Effect.sync(() => {
        if (!initialized) {
          createSchema();
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
        });

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
        } as SQLQueryBindings) as Array<{
          id: number;
          account_id: string;
          timestamp: string;
          run_at: string;
          mode: string;
          total_resources: number;
        }>;

        return rows.map((row) => ({
          id: row.id,
          accountId: row.account_id,
          timestamp: row.timestamp,
          runAt: row.run_at,
          mode: row.mode,
          totalResources: row.total_resources,
        }));
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
        const rows = query.all(params as SQLQueryBindings) as Array<{
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
        }>;

        return rows.map((row) => ({
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
        }));
      }),

    queryResources: (accountId, options) =>
      Effect.sync(() => {
        if (!initialized) {
          createSchema();
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
        const rows = query.all(params as SQLQueryBindings) as Array<{
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
          run_at: string;
        }>;

        const grouped = new Map<string, ResourceRecord[]>();

        for (const row of rows) {
          const record: ResourceRecord = {
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
          };

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
          createSchema();
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

        const runs = runsQuery.all({ $accountId: accountId, $days: days }) as Array<{
          id: number;
          run_at: string;
        }>;

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

          const rows = query.all({ $runId: runId }) as Array<{
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
          }>;

          const map = new Map<string, ResourceRecord>();
          for (const row of rows) {
            const record: ResourceRecord = {
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
            };
            map.set(row.arn, record);
          }
          return map;
        };

        const currentResources = getResourcesForRun(currentRun.id);
        const previousResources = getResourcesForRun(previousRun.id);

        const changes: Array<{
          type: string;
          name: string;
          region: string;
          change: "added" | "removed" | "modified";
          oldValue: string | null;
          newValue: string | null;
        }> = [];

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
        const computeFingerprint = (r: {
          type: string;
          name: string;
          region: string;
          state?: string;
          size?: string;
          encrypted?: string;
          publicAccess?: string;
        }): string => {
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

        const newResources: typeof resources = [];
        const changedResources: typeof resources = [];
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
        const computeFingerprint = (r: {
          type: string;
          name: string;
          region: string;
          state?: string;
          size?: string;
          encrypted?: string;
          publicAccess?: string;
        }): string => {
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

    close: () =>
      Effect.sync(() => {
        db.close();
      }),
  });
};

const runEffect = <A, E>(
  effect: Effect.Effect<A, E, InventoryDbService>,
  dbService: InventoryDbService,
): Promise<A> => {
  return Effect.runPromise(Effect.provide(effect, Layer.succeed(InventoryDbService, dbService)));
};

describe("queryInventoryEffect", () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: InventoryDbService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "cloudops-query-test-"));
    dbPath = join(tempDir, "test.db");
    dbService = createTestDbService(dbPath);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("returns empty array when no data exists", async () => {
    const result = await runEffect(queryInventoryEffect("test-account", {}), dbService);

    expect(result).toEqual([]);
  });

  test("returns resources from single run", async () => {
    await runEffect(
      Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("test-account", "basic", [
          {
            type: "EC2",
            name: "i-1",
            region: "us-east-1",
            arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
          },
        ]);
      }),
      dbService,
    );

    const result = await runEffect(queryInventoryEffect("test-account", {}), dbService);

    expect(result).toHaveLength(1);
    expect(result[0]?.resources).toHaveLength(1);
    expect(result[0]?.resources[0]?.type).toBe("EC2");
  });

  test("filters by type", async () => {
    await runEffect(
      Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("test-account", "basic", [
          {
            type: "EC2",
            name: "i-1",
            region: "us-east-1",
            arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
          },
          {
            type: "RDS",
            name: "db-1",
            region: "us-east-1",
            arn: "arn:aws:rds:us-east-1:123:db:db-1",
          },
        ]);
      }),
      dbService,
    );

    const result = await runEffect(
      queryInventoryEffect("test-account", { type: "EC2" }),
      dbService,
    );

    const allResources = result.flatMap((r) => r.resources);
    expect(allResources).toHaveLength(1);
    expect(allResources[0]?.type).toBe("EC2");
  });

  test("filters by region", async () => {
    await runEffect(
      Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("test-account", "basic", [
          {
            type: "EC2",
            name: "i-1",
            region: "us-east-1",
            arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
          },
          {
            type: "EC2",
            name: "i-2",
            region: "us-west-2",
            arn: "arn:aws:ec2:us-west-2:123:instance/i-2",
          },
        ]);
      }),
      dbService,
    );

    const result = await runEffect(
      queryInventoryEffect("test-account", { region: "us-east-1" }),
      dbService,
    );

    const allResources = result.flatMap((r) => r.resources);
    expect(allResources).toHaveLength(1);
    expect(allResources[0]?.region).toBe("us-east-1");
  });
});

describe("getInventoryChangesEffect", () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: InventoryDbService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "cloudops-changes-test-"));
    dbPath = join(tempDir, "test.db");
    dbService = createTestDbService(dbPath);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("returns empty when less than 2 runs", async () => {
    await runEffect(
      Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("test-account", "basic", [
          {
            type: "EC2",
            name: "i-1",
            region: "us-east-1",
            arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
          },
        ]);
      }),
      dbService,
    );

    const result = await runEffect(getInventoryChangesEffect("test-account", 7), dbService);

    expect(result).toEqual([]);
  });

  test("detects added resources", async () => {
    await runEffect(
      Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("test-account", "basic", [
          {
            type: "EC2",
            name: "i-1",
            region: "us-east-1",
            arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
          },
        ]);
        yield* db.saveRun("test-account", "basic", [
          {
            type: "EC2",
            name: "i-1",
            region: "us-east-1",
            arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
          },
          {
            type: "RDS",
            name: "db-1",
            region: "us-east-1",
            arn: "arn:aws:rds:us-east-1:123:db:db-1",
          },
        ]);
      }),
      dbService,
    );

    const result = await runEffect(getInventoryChangesEffect("test-account", 7), dbService);

    const added = result.filter((c) => c.change === "added");
    expect(added).toHaveLength(1);
    expect(added[0]?.type).toBe("RDS");
  });
});

describe("listInventoryRunsEffect", () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: InventoryDbService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "cloudops-list-runs-test-"));
    dbPath = join(tempDir, "test.db");
    dbService = createTestDbService(dbPath);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  test("returns empty when no runs", async () => {
    const result = await runEffect(listInventoryRunsEffect("test-account", 10), dbService);

    expect(result).toEqual([]);
  });

  test("returns runs in descending order", async () => {
    await runEffect(
      Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("test-account", "basic", [
          {
            type: "EC2",
            name: "i-1",
            region: "us-east-1",
            arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
          },
        ]);
        yield* db.saveRun("test-account", "security", [
          {
            type: "EC2",
            name: "i-1",
            region: "us-east-1",
            arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
          },
        ]);
      }),
      dbService,
    );

    const result = await runEffect(listInventoryRunsEffect("test-account", 10), dbService);

    expect(result).toHaveLength(2);
    expect(result[0]?.mode).toBe("security");
    expect(result[1]?.mode).toBe("basic");
  });

  test("respects limit", async () => {
    await runEffect(
      Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("test-account", "basic", []);
        yield* db.saveRun("test-account", "basic", []);
        yield* db.saveRun("test-account", "basic", []);
      }),
      dbService,
    );

    const result = await runEffect(listInventoryRunsEffect("test-account", 2), dbService);

    expect(result).toHaveLength(2);
  });
});
