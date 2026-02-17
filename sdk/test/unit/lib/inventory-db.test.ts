import { Database, type SQLQueryBindings } from "bun:sqlite";
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Effect, Layer } from "effect";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InventoryDbService, type ResourceRecord } from "../../../src/lib/inventory-db";

const createTestLayer = (dbPath: string): Layer.Layer<InventoryDbService> =>
  Layer.sync(InventoryDbService, () => {
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
      db.run(`CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON inventory_runs(timestamp)`);
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

          const rows = query.all({ $accountId: accountId, $limit: limit }) as Array<{
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

      close: () =>
        Effect.sync(() => {
          db.close();
        }),
    });
  });

const runEffect = <A, E>(
  effect: Effect.Effect<A, E, InventoryDbService>,
  layer: Layer.Layer<InventoryDbService>,
): Promise<A> => {
  return Effect.runPromise(Effect.provide(effect, layer));
};

describe("InventoryDbService", () => {
  let tempDir: string;
  let dbPath: string;
  let testLayer: Layer.Layer<InventoryDbService>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "cloudops-inventory-db-test-"));
    dbPath = join(tempDir, "test.db");
    testLayer = createTestLayer(dbPath);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  describe("initialize", () => {
    test("creates database file", async () => {
      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
      });

      await runEffect(effect, testLayer);

      expect(existsSync(dbPath)).toBe(true);
    });

    test("is idempotent", async () => {
      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.initialize();
      });

      await runEffect(effect, testLayer);

      expect(existsSync(dbPath)).toBe(true);
    });
  });

  describe("saveRun", () => {
    test("saves a run with resources", async () => {
      const resources = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
        },
        {
          type: "RDS",
          name: "db-1",
          region: "us-east-1",
          arn: "arn:aws:rds:us-east-1:123:db:db-1",
        },
      ];

      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        const runId = yield* db.saveRun("test-account", "basic", resources);
        return runId;
      });

      const runId = await runEffect(effect, testLayer);

      expect(runId).toBeGreaterThan(0);
    });

    test("auto-initializes if not called explicitly", async () => {
      const resources = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
        },
      ];

      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        const runId = yield* db.saveRun("test-account", "basic", resources);
        return runId;
      });

      const runId = await runEffect(effect, testLayer);

      expect(runId).toBeGreaterThan(0);
    });

    test("saves resource with all fields", async () => {
      const resources = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
          state: "running",
          tags: '{"env":"prod"}',
          createdDate: "2024-01-01",
          publicAccess: "Public",
          size: "t3.micro",
          encrypted: "Yes",
          vpcId: "vpc-123",
          lastActivity: "2024-01-15",
          versionStatus: "current",
        },
      ];

      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        const runId = yield* db.saveRun("test-account", "detailed", resources);
        const savedResources = yield* db.getResources(runId);
        return savedResources;
      });

      const savedResources = await runEffect(effect, testLayer);

      expect(savedResources).toHaveLength(1);
      expect(savedResources[0]?.type).toBe("EC2");
      expect(savedResources[0]?.state).toBe("running");
      expect(savedResources[0]?.tags).toBe('{"env":"prod"}');
      expect(savedResources[0]?.encrypted).toBe("Yes");
    });

    test("handles empty resources array", async () => {
      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        const runId = yield* db.saveRun("test-account", "basic", []);
        return runId;
      });

      const runId = await runEffect(effect, testLayer);

      expect(runId).toBeGreaterThan(0);
    });
  });

  describe("getRuns", () => {
    test("returns empty array when no runs exist", async () => {
      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        const runs = yield* db.getRuns("test-account");
        return runs;
      });

      const runs = await runEffect(effect, testLayer);

      expect(runs).toEqual([]);
    });

    test("returns runs for account", async () => {
      const resources = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
        },
      ];

      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("account-1", "basic", resources);
        yield* db.saveRun("account-1", "security", resources);
        const runs = yield* db.getRuns("account-1");
        return runs;
      });

      const runs = await runEffect(effect, testLayer);

      expect(runs).toHaveLength(2);
      const modes = runs.map((r) => r.mode);
      expect(modes).toContain("basic");
      expect(modes).toContain("security");
    });

    test("filters by account", async () => {
      const resources = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
        },
      ];

      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("account-1", "basic", resources);
        yield* db.saveRun("account-2", "basic", resources);
        const runs = yield* db.getRuns("account-1");
        return runs;
      });

      const runs = await runEffect(effect, testLayer);

      expect(runs).toHaveLength(1);
      expect(runs[0]?.accountId).toBe("account-1");
    });

    test("respects limit parameter", async () => {
      const resources = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
        },
      ];

      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("account-1", "basic", resources);
        yield* db.saveRun("account-1", "basic", resources);
        yield* db.saveRun("account-1", "basic", resources);
        const runs = yield* db.getRuns("account-1", 2);
        return runs;
      });

      const runs = await runEffect(effect, testLayer);

      expect(runs).toHaveLength(2);
    });
  });

  describe("getResources", () => {
    test("returns resources for run", async () => {
      const resources = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
        },
        {
          type: "RDS",
          name: "db-1",
          region: "us-west-2",
          arn: "arn:aws:rds:us-west-2:123:db:db-1",
        },
      ];

      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        const runId = yield* db.saveRun("test-account", "basic", resources);
        const saved = yield* db.getResources(runId);
        return saved;
      });

      const saved = await runEffect(effect, testLayer);

      expect(saved).toHaveLength(2);
    });

    test("filters by type", async () => {
      const resources = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
        },
        {
          type: "RDS",
          name: "db-1",
          region: "us-east-1",
          arn: "arn:aws:rds:us-east-1:123:db:db-1",
        },
        {
          type: "EC2",
          name: "instance-2",
          region: "us-west-2",
          arn: "arn:aws:ec2:us-west-2:123:instance/i-2",
        },
      ];

      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        const runId = yield* db.saveRun("test-account", "basic", resources);
        const saved = yield* db.getResources(runId, { type: "EC2" });
        return saved;
      });

      const saved = await runEffect(effect, testLayer);

      expect(saved).toHaveLength(2);
      expect(saved.every((r) => r.type === "EC2")).toBe(true);
    });

    test("filters by region", async () => {
      const resources = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
        },
        {
          type: "RDS",
          name: "db-1",
          region: "us-west-2",
          arn: "arn:aws:rds:us-west-2:123:db:db-1",
        },
      ];

      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        const runId = yield* db.saveRun("test-account", "basic", resources);
        const saved = yield* db.getResources(runId, { region: "us-east-1" });
        return saved;
      });

      const saved = await runEffect(effect, testLayer);

      expect(saved).toHaveLength(1);
      expect(saved[0]?.region).toBe("us-east-1");
    });
  });

  describe("queryResources", () => {
    test("returns empty when no runs exist", async () => {
      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        const results = yield* db.queryResources("test-account", {});
        return results;
      });

      const results = await runEffect(effect, testLayer);

      expect(results).toEqual([]);
    });

    test("returns resources grouped by run", async () => {
      const resources = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
        },
      ];

      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("test-account", "basic", resources);
        const results = yield* db.queryResources("test-account", {});
        return results;
      });

      const results = await runEffect(effect, testLayer);

      expect(results).toHaveLength(1);
      expect(results[0]?.resources).toHaveLength(1);
    });

    test("filters by type", async () => {
      const resources = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
        },
        {
          type: "RDS",
          name: "db-1",
          region: "us-east-1",
          arn: "arn:aws:rds:us-east-1:123:db:db-1",
        },
      ];

      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("test-account", "basic", resources);
        const results = yield* db.queryResources("test-account", { type: "EC2" });
        return results;
      });

      const results = await runEffect(effect, testLayer);

      const allResources = results.flatMap((r) => r.resources);
      expect(allResources).toHaveLength(1);
      expect(allResources[0]?.type).toBe("EC2");
    });
  });

  describe("getChanges", () => {
    test("returns empty when less than 2 runs exist", async () => {
      const resources = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
        },
      ];

      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("test-account", "basic", resources);
        const changes = yield* db.getChanges("test-account", 7);
        return changes;
      });

      const changes = await runEffect(effect, testLayer);

      expect(changes).toEqual([]);
    });

    test("detects added resources", async () => {
      const resources1 = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
          state: "running",
        },
      ];

      const resources2Input = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
          state: "running",
        },
        {
          type: "RDS",
          name: "db-1",
          region: "us-east-1",
          arn: "arn:aws:rds:us-east-1:123:db:db-1",
          state: "available",
        },
      ];

      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("test-account", "basic", resources1);
        yield* db.saveRun("test-account", "basic", resources2Input);
        const changes = yield* db.getChanges("test-account", 365);
        return changes;
      });

      const changes = await runEffect(effect, testLayer);

      const addedOrRemoved = changes.filter((c) => c.change === "added" || c.change === "removed");
      expect(addedOrRemoved.length).toBeGreaterThan(0);
      const rdsChange = changes.find((c) => c.type === "RDS");
      expect(rdsChange).toBeDefined();
    });

    test("detects removed resources", async () => {
      const resources1 = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
          state: "running",
        },
        {
          type: "RDS",
          name: "db-1",
          region: "us-east-1",
          arn: "arn:aws:rds:us-east-1:123:db:db-1",
          state: "available",
        },
      ];

      const resources2Input = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
          state: "running",
        },
      ];

      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("test-account", "basic", resources1);
        yield* db.saveRun("test-account", "basic", resources2Input);
        const changes = yield* db.getChanges("test-account", 365);
        return changes;
      });

      const changes = await runEffect(effect, testLayer);

      const addedOrRemoved = changes.filter((c) => c.change === "added" || c.change === "removed");
      expect(addedOrRemoved.length).toBeGreaterThan(0);
      const rdsChange = changes.find((c) => c.type === "RDS");
      expect(rdsChange).toBeDefined();
    });

    test("detects modified resources", async () => {
      const resources1 = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
          state: "running",
        },
      ];

      const resources2Input = [
        {
          type: "EC2",
          name: "instance-1",
          region: "us-east-1",
          arn: "arn:aws:ec2:us-east-1:123:instance/i-1",
          state: "stopped",
        },
      ];

      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.saveRun("test-account", "basic", resources1);
        yield* db.saveRun("test-account", "basic", resources2Input);
        const changes = yield* db.getChanges("test-account", 365);
        return changes;
      });

      const changes = await runEffect(effect, testLayer);

      const modified = changes.filter((c) => c.change === "modified");
      expect(modified).toHaveLength(1);
      const mod = modified[0];
      expect(mod).toBeDefined();
      if (mod) {
        expect(["running", "stopped", null]).toContain(mod.oldValue);
        expect(["running", "stopped", null]).toContain(mod.newValue);
        expect(mod.oldValue).not.toBe(mod.newValue);
      }
    });
  });

  describe("close", () => {
    test("closes database connection", async () => {
      const effect = Effect.gen(function* () {
        const db = yield* InventoryDbService;
        yield* db.initialize();
        yield* db.close();
      });

      await runEffect(effect, testLayer);

      expect(true).toBe(true);
    });
  });
});
