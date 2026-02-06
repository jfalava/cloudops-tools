import { DatabaseService, ComputeService, NetworkingService } from "@cloudops-tools/sdk";
import { Effect } from "effect";

export type DescribeHandler = {
  title: string;
  fetchByRegion: (
    regionName: string,
  ) => Effect.Effect<ReadonlyArray<Record<string, unknown>>, unknown>;
};

const addRegion = <T extends object>(items: T[], regionName: string): Record<string, unknown>[] =>
  items.map((item) => ({ ...item, region: regionName }));

export const getDescribeHandler = (
  type: string,
  database: DatabaseService,
  compute: ComputeService,
  networking: NetworkingService,
): DescribeHandler | null => {
  switch (type.toUpperCase()) {
    case "RDS":
      return {
        title: "RDS Instances",
        fetchByRegion: (regionName) =>
          database
            .describeRDS(regionName)
            .pipe(Effect.map((items) => addRegion(items, regionName))),
      };
    case "EC2":
      return {
        title: "EC2 Instances",
        fetchByRegion: (regionName) =>
          compute.describeEC2(regionName).pipe(Effect.map((items) => addRegion(items, regionName))),
      };
    case "LAMBDA":
      return {
        title: "Lambda Functions",
        fetchByRegion: (regionName) =>
          compute
            .describeLambda(regionName)
            .pipe(Effect.map((items) => addRegion(items, regionName))),
      };
    case "VPC":
      return {
        title: "VPCs",
        fetchByRegion: (regionName) =>
          networking
            .describeVPCs(regionName)
            .pipe(Effect.map((items) => addRegion(items, regionName))),
      };
    case "DYNAMODB":
      return {
        title: "DynamoDB Tables",
        fetchByRegion: (regionName) =>
          database
            .describeDynamoDB(regionName)
            .pipe(Effect.map((items) => addRegion(items, regionName))),
      };
    default:
      return null;
  }
};

export const SUPPORTED_DESCRIBE_TYPES = ["rds", "ec2", "lambda", "vpc", "dynamodb"] as const;
