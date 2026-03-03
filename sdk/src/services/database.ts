import type {
  RDSInstance,
  DynamoDBTable,
  RedshiftCluster,
  OpenSearchDomain,
  ElastiCacheCluster,
  DAXCluster,
  DocDBCluster,
  NeptuneCluster,
  MemoryDBCluster,
  TimestreamDatabase,
  KeyspacesKeyspace,
  RedshiftServerlessNamespace,
  OpenSearchServerlessCollection,
} from "@cloudops-tools/types/aws";
import * as DAX from "distilled-aws/dax";
import * as DynamoDB from "distilled-aws/dynamodb";
import * as Keyspaces from "distilled-aws/keyspaces";
import * as MemoryDB from "distilled-aws/memorydb";
import * as OpenSearch from "distilled-aws/opensearch";
import * as OpenSearchServerless from "distilled-aws/opensearchserverless";
import * as Redshift from "distilled-aws/redshift";
import * as RedshiftServerless from "distilled-aws/redshift-serverless";
import * as TimestreamWrite from "distilled-aws/timestream-write";
import { Context, Effect, Stream, Layer } from "effect";

import { makeRegionConfig, AwsConfigLive } from "../lib/aws-config";
import {
  describeRdsInstances,
  getRdsInstance,
  describeElastiCacheClusters,
  describeDocDBClusters,
  describeNeptuneClusters,
} from "../patches";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const getRecord = (value: unknown, key: string): UnknownRecord | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const nested = value[key];
  return isRecord(nested) ? nested : undefined;
};

const getArray = (value: unknown, key: string): readonly unknown[] => {
  if (!isRecord(value)) {
    return [];
  }
  const nested = value[key];
  return Array.isArray(nested) ? nested : [];
};

const getString = (value: unknown, key: string, fallback?: string): string | undefined => {
  if (!isRecord(value)) {
    return fallback;
  }
  const nested = value[key];
  return typeof nested === "string" ? nested : fallback;
};

const getNumber = (value: unknown, key: string, fallback = 0): number => {
  if (!isRecord(value)) {
    return fallback;
  }
  const nested = value[key];
  return typeof nested === "number" ? nested : fallback;
};

const getBoolean = (value: unknown, key: string, fallback = false): boolean => {
  if (!isRecord(value)) {
    return fallback;
  }
  const nested = value[key];
  return typeof nested === "boolean" ? nested : fallback;
};

const getDateIsoString = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const nested = value[key];
  return nested instanceof Date ? nested.toISOString() : undefined;
};

const hasDefinedKey = (value: unknown, key: string): boolean =>
  isRecord(value) && value[key] !== undefined;

const toTagRecord = (
  values: readonly unknown[],
  keyField: string,
  valueField: string,
): Record<string, string> =>
  values.reduce<Record<string, string>>((acc, value) => {
    if (!isRecord(value)) {
      return acc;
    }
    const tagKey = value[keyField];
    if (typeof tagKey !== "string") {
      return acc;
    }
    const tagValue = value[valueField];
    acc[tagKey] = typeof tagValue === "string" ? tagValue : "";
    return acc;
  }, {});

export interface DatabaseService {
  readonly describeRDS: (region: string) => Effect.Effect<RDSInstance[], unknown>;
  readonly getRDSDetails: (
    region: string,
    dbInstanceIdentifier: string,
  ) => Effect.Effect<unknown, unknown>;
  readonly describeDynamoDB: (region: string) => Effect.Effect<DynamoDBTable[], unknown>;
  readonly getDynamoDBDetails: (
    region: string,
    tableName: string,
  ) => Effect.Effect<unknown, unknown>;
  readonly describeRedshift: (region: string) => Effect.Effect<RedshiftCluster[], unknown>;
  readonly describeOpenSearch: (region: string) => Effect.Effect<OpenSearchDomain[], unknown>;
  readonly describeElastiCache: (region: string) => Effect.Effect<ElastiCacheCluster[], unknown>;
  readonly describeDAX: (region: string) => Effect.Effect<DAXCluster[], unknown>;
  readonly describeDocDB: (region: string) => Effect.Effect<DocDBCluster[], unknown>;
  readonly describeNeptune: (region: string) => Effect.Effect<NeptuneCluster[], unknown>;
  readonly describeMemoryDB: (region: string) => Effect.Effect<MemoryDBCluster[], unknown>;
  readonly describeTimestreamDatabases: (
    region: string,
  ) => Effect.Effect<TimestreamDatabase[], unknown>;
  readonly describeKeyspaces: (region: string) => Effect.Effect<KeyspacesKeyspace[], unknown>;
  readonly describeRedshiftServerlessNamespaces: (
    region: string,
  ) => Effect.Effect<RedshiftServerlessNamespace[], unknown>;
  readonly describeOpenSearchServerlessCollections: (
    region: string,
  ) => Effect.Effect<OpenSearchServerlessCollection[], unknown>;
}

export const DatabaseService = Context.GenericTag<DatabaseService>("@sdk/services/DatabaseService");

export const DatabaseServiceLive = Layer.succeed(
  DatabaseService,
  DatabaseService.of({
    describeRDS: (region: string) => describeRdsInstances(region),

    getRDSDetails: (region: string, dbInstanceIdentifier: string) =>
      getRdsInstance(region, dbInstanceIdentifier),

    describeDynamoDB: (region: string) =>
      Effect.gen(function* (_) {
        const config = makeRegionConfig(region);

        const tableNames = yield* _(
          DynamoDB.listTables.items({}).pipe(
            Stream.runCollect,
            Effect.map((chunk) =>
              Array.from(chunk).filter(
                (tableName): tableName is string => typeof tableName === "string",
              ),
            ),
            Effect.provide(config),
            Effect.provide(AwsConfigLive),
          ),
        );

        return yield* _(
          Effect.forEach(
            tableNames,
            (tableName) =>
              Effect.gen(function* (__inner) {
                const tableResp = yield* __inner(
                  DynamoDB.describeTable({ TableName: tableName }).pipe(
                    Effect.provide(config),
                    Effect.provide(AwsConfigLive),
                  ),
                );

                const table = getRecord(tableResp, "Table");
                if (!table) {
                  return null;
                }

                let tags: Record<string, string> = {};
                const tableArn = getString(table, "TableArn");
                if (tableArn) {
                  tags = yield* __inner(
                    DynamoDB.listTagsOfResource({ ResourceArn: tableArn }).pipe(
                      Effect.map((response) =>
                        toTagRecord(getArray(response, "Tags"), "Key", "Value"),
                      ),
                      Effect.catchAll(() => Effect.succeed({})),
                      Effect.provide(config),
                      Effect.provide(AwsConfigLive),
                    ),
                  );
                }

                return {
                  name: getString(table, "TableName", "unknown") ?? "unknown",
                  status: getString(table, "TableStatus", "UNKNOWN") ?? "UNKNOWN",
                  itemCount: getNumber(table, "ItemCount"),
                  createdDate: getDateIsoString(table, "CreationDateTime"),
                  sizeBytes: getNumber(table, "TableSizeBytes"),
                  encrypted: getString(getRecord(table, "SSEDescription"), "Status") === "ENABLED",
                  tags,
                } as DynamoDBTable;
              }),
            { concurrency: 5 },
          ),
          Effect.map((results) => results.filter((t): t is DynamoDBTable => t !== null)),
        );
      }),

    getDynamoDBDetails: (region: string, tableName: string) =>
      DynamoDB.describeTable({ TableName: tableName }).pipe(
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeRedshift: (region: string) =>
      Redshift.describeClusters.items({}).pipe(
        Stream.map(
          (cluster): RedshiftCluster => ({
            clusterIdentifier: getString(cluster, "ClusterIdentifier", "unknown") ?? "unknown",
            nodeType: getString(cluster, "NodeType", "unknown") ?? "unknown",
            clusterStatus: getString(cluster, "ClusterStatus", "unknown") ?? "unknown",
            masterUsername: getString(cluster, "MasterUsername", "unknown") ?? "unknown",
            dbName: getString(cluster, "DBName", "N/A") ?? "N/A",
            endpoint: getString(getRecord(cluster, "Endpoint"), "Address", "N/A") ?? "N/A",
            port: getNumber(getRecord(cluster, "Endpoint"), "Port"),
          }),
        ),
        Stream.runCollect,
        Effect.map((chunk) => Array.from(chunk)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeOpenSearch: (region: string) =>
      Effect.gen(function* (_) {
        const config = makeRegionConfig(region);
        const listResp = yield* _(
          OpenSearch.listDomainNames({}).pipe(
            Effect.provide(config),
            Effect.provide(AwsConfigLive),
          ),
        );

        const domainNames = getArray(listResp, "DomainNames")
          .map((domain) => getString(domain, "DomainName"))
          .filter((name): name is string => Boolean(name));

        if (domainNames.length === 0) {
          return [];
        }

        return yield* _(
          Effect.forEach(
            domainNames,
            (domainName) =>
              OpenSearch.describeDomain({ DomainName: domainName }).pipe(
                Effect.map((response) => getRecord(response, "DomainStatus")),
                Effect.map((domain): OpenSearchDomain | null =>
                  domain
                    ? {
                        domainName: getString(domain, "DomainName", "unknown") ?? "unknown",
                        arn: getString(domain, "ARN", "unknown") ?? "unknown",
                        created: getBoolean(domain, "Created"),
                        deleted: getBoolean(domain, "Deleted"),
                        endpoint: getString(domain, "Endpoint", "N/A") ?? "N/A",
                        multiAzWithStandbyEnabled: false,
                        upgradeProcessing: getBoolean(domain, "UpgradeProcessing"),
                      }
                    : null,
                ),
                Effect.provide(config),
                Effect.provide(AwsConfigLive),
              ),
            { concurrency: 5 },
          ),
          Effect.map((results) => results.filter((d): d is OpenSearchDomain => d !== null)),
        );
      }),

    describeElastiCache: (region: string) => describeElastiCacheClusters(region),

    describeDAX: (region: string) =>
      DAX.describeClusters({}).pipe(
        Effect.map((response) =>
          getArray(response, "Clusters").map(
            (cluster): DAXCluster => ({
              name: getString(cluster, "ClusterName", "unknown") ?? "unknown",
              arn: getString(cluster, "ClusterArn"),
              status: getString(cluster, "Status"),
              nodeType: getString(cluster, "NodeType"),
            }),
          ),
        ),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeDocDB: (region: string) => describeDocDBClusters(region),

    describeNeptune: (region: string) => describeNeptuneClusters(region),

    describeMemoryDB: (region: string) =>
      MemoryDB.describeClusters.items({}).pipe(
        Stream.map(
          (cluster): MemoryDBCluster => ({
            name: getString(cluster, "Name", "unknown") ?? "unknown",
            arn: getString(cluster, "ARN"),
            status: getString(cluster, "Status"),
            nodeType: getString(cluster, "NodeType"),
          }),
        ),
        Stream.runCollect,
        Effect.map((chunk) => Array.from(chunk)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeTimestreamDatabases: (region: string) =>
      TimestreamWrite.listDatabases.items({}).pipe(
        Stream.map(
          (database): TimestreamDatabase => ({
            name: getString(database, "DatabaseName", "unknown") ?? "unknown",
            arn: getString(database, "Arn"),
            status: hasDefinedKey(database, "TableCount") ? "ACTIVE" : undefined,
            createdAt: getDateIsoString(database, "CreationTime"),
          }),
        ),
        Stream.runCollect,
        Effect.map((chunk) => Array.from(chunk)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeKeyspaces: (region: string) =>
      Keyspaces.listKeyspaces.items({}).pipe(
        Stream.map(
          (keyspace): KeyspacesKeyspace => ({
            name: getString(keyspace, "KeyspaceName", "unknown") ?? "unknown",
            arn: getString(keyspace, "KeyspaceArn"),
          }),
        ),
        Stream.runCollect,
        Effect.map((chunk) => Array.from(chunk)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeRedshiftServerlessNamespaces: (region: string) =>
      RedshiftServerless.listNamespaces.items({}).pipe(
        Stream.map(
          (namespace): RedshiftServerlessNamespace => ({
            name: getString(namespace, "NamespaceName", "unknown") ?? "unknown",
            arn: getString(namespace, "NamespaceArn"),
            status: getString(namespace, "Status"),
          }),
        ),
        Stream.runCollect,
        Effect.map((chunk) => Array.from(chunk)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeOpenSearchServerlessCollections: (region: string) =>
      OpenSearchServerless.listCollections.items({}).pipe(
        Stream.map(
          (collection): OpenSearchServerlessCollection => ({
            name: getString(collection, "Name", "unknown") ?? "unknown",
            id: getString(collection, "Id"),
            status: getString(collection, "Status"),
          }),
        ),
        Stream.runCollect,
        Effect.map((chunk) => Array.from(chunk)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),
  }),
);
