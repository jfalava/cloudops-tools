import {
  DatabaseService,
  ComputeService,
  NetworkingService,
  InventoryDbService,
} from "@cloudops-tools/sdk";
import { Effect } from "effect";

export type DescribeHandler = {
  title: string;
  fetchByRegion: (
    regionName: string,
  ) => Effect.Effect<ReadonlyArray<Record<string, unknown>>, unknown, InventoryDbService>;
};

const addRegion = <T extends object>(items: T[], regionName: string): Record<string, unknown>[] =>
  items.map((item) => ({ ...item, region: regionName }));

export interface DescribeHandlerConfig {
  readonly database: DatabaseService;
  readonly compute: ComputeService;
  readonly networking: NetworkingService;
  readonly useCache?: boolean;
  readonly cacheTtlSeconds?: number;
}

export const getDescribeHandler = (
  type: string,
  config: DescribeHandlerConfig,
): DescribeHandler | null => {
  const { database, compute, networking, useCache = true, cacheTtlSeconds = 300 } = config;

  const wrapWithCache =
    (
      resourceType: string,
      fetcher: (region: string) => Effect.Effect<unknown, unknown>,
    ): ((
      regionName: string,
    ) => Effect.Effect<ReadonlyArray<Record<string, unknown>>, unknown, InventoryDbService>) =>
    (regionName) =>
      Effect.gen(function* (_) {
        const dbService = yield* _(InventoryDbService);
        yield* _(dbService.initialize());

        if (useCache) {
          const cached = yield* _(dbService.getDescribeCache(resourceType, regionName));
          if (cached) {
            return JSON.parse(cached.data) as ReadonlyArray<Record<string, unknown>>;
          }
        }

        const items = (yield* _(fetcher(regionName))) as object[];
        const itemsWithRegion = addRegion(items, regionName);

        if (useCache) {
          yield* _(
            dbService.setDescribeCache(resourceType, regionName, itemsWithRegion, cacheTtlSeconds),
          );
        }

        return itemsWithRegion;
      });

  switch (type.toUpperCase()) {
    case "RDS":
      return {
        title: "RDS Instances",
        fetchByRegion: wrapWithCache("RDS", (region) => database.describeRDS(region)),
      };
    case "EC2":
      return {
        title: "EC2 Instances",
        fetchByRegion: wrapWithCache("EC2", (region) => compute.describeEC2(region)),
      };
    case "LAMBDA":
      return {
        title: "Lambda Functions",
        fetchByRegion: wrapWithCache("LAMBDA", (region) => compute.describeLambda(region)),
      };
    case "VPC":
      return {
        title: "VPCs",
        fetchByRegion: wrapWithCache("VPC", (region) => networking.describeVPCs(region)),
      };
    case "DYNAMODB":
      return {
        title: "DynamoDB Tables",
        fetchByRegion: wrapWithCache("DYNAMODB", (region) => database.describeDynamoDB(region)),
      };
    default:
      return null;
  }
};

export const SUPPORTED_DESCRIBE_TYPES = ["rds", "ec2", "lambda", "vpc", "dynamodb"] as const;
