import { CloudFrontClient, ListDistributionsCommand } from "@aws-sdk/client-cloudfront";
import {
  DocDBClient,
  DescribeDBClustersCommand as DocDBDescribeDBClustersCommand,
} from "@aws-sdk/client-docdb";
import {
  ElasticBeanstalkClient,
  DescribeEnvironmentsCommand,
} from "@aws-sdk/client-elastic-beanstalk";
import {
  ElastiCacheClient,
  DescribeCacheClustersCommand,
  type CacheCluster,
} from "@aws-sdk/client-elasticache";
import {
  GlobalAcceleratorClient,
  ListAcceleratorsCommand,
} from "@aws-sdk/client-global-accelerator";
import {
  NeptuneClient,
  DescribeDBClustersCommand as NeptuneDescribeDBClustersCommand,
} from "@aws-sdk/client-neptune";
import { RDSClient, DescribeDBInstancesCommand, type DBInstance } from "@aws-sdk/client-rds";
import { Route53Client, ListHostedZonesCommand } from "@aws-sdk/client-route-53";
import type {
  RDSInstance,
  ElastiCacheCluster,
  DocDBCluster,
  NeptuneCluster,
  ElasticBeanstalkEnvironment,
  CloudFrontDistribution,
  Route53HostedZone,
  GlobalAccelerator,
} from "@cloudops-tools/types/aws";
import { Effect } from "effect";

import { getCredentialsProvider } from "../credentials/credentials";

/**
 * Patch layer: use AWS SDK v3 directly for AWS Query services that currently
 * error in distilled-aws ("InvalidAction: Could not find operation ...").
 *
 * This is a valid and stable implementation; it can remain even after the
 * underlying protocol bug is fixed.
 */

const makeCredentials = () => getCredentialsProvider();

const mapRdsInstance = (db: DBInstance): RDSInstance => ({
  id: db.DBInstanceIdentifier || "unknown",
  name: db.DBName || "N/A",
  engine: db.Engine || "unknown",
  engineVersion: db.EngineVersion,
  status: db.DBInstanceStatus || "unknown",
  instanceClass: db.DBInstanceClass || "unknown",
  storageSize: db.AllocatedStorage || 0,
  vpcId: db.DBSubnetGroup?.VpcId,
  publiclyAccessible: db.PubliclyAccessible || false,
  encrypted: db.StorageEncrypted || false,
  createTime: db.InstanceCreateTime?.toISOString(),
  tags: (db.TagList || []).reduce(
    (acc, tag) => {
      if (tag.Key) {
        acc[tag.Key] = tag.Value || "";
      }
      return acc;
    },
    {} as Record<string, string>,
  ),
});

export const describeRdsInstances = (region: string) =>
  Effect.tryPromise({
    try: async () => {
      const client = new RDSClient({ region, credentials: makeCredentials() });
      const resp = await client.send(new DescribeDBInstancesCommand({}));
      return (resp.DBInstances || []).map(mapRdsInstance);
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });

export const getRdsInstance = (region: string, dbInstanceIdentifier: string) =>
  Effect.tryPromise({
    try: async () => {
      const client = new RDSClient({ region, credentials: makeCredentials() });
      const resp = await client.send(
        new DescribeDBInstancesCommand({ DBInstanceIdentifier: dbInstanceIdentifier }),
      );
      return resp.DBInstances?.[0];
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });

const mapElastiCacheCluster = (cluster: CacheCluster): ElastiCacheCluster => ({
  cacheClusterId: cluster.CacheClusterId || "unknown",
  cacheNodeType: cluster.CacheNodeType || "unknown",
  engine: cluster.Engine || "unknown",
  engineVersion: cluster.EngineVersion,
  cacheClusterStatus: cluster.CacheClusterStatus || "unknown",
  numCacheNodes: cluster.NumCacheNodes || 0,
  preferredAvailabilityZone: cluster.PreferredAvailabilityZone || "N/A",
  cacheClusterCreateTime: cluster.CacheClusterCreateTime?.toISOString(),
  tags: {},
});

export const describeElastiCacheClusters = (region: string) =>
  Effect.tryPromise({
    try: async () => {
      const client = new ElastiCacheClient({ region, credentials: makeCredentials() });
      const resp = await client.send(new DescribeCacheClustersCommand({}));
      return (resp.CacheClusters || []).map(mapElastiCacheCluster);
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });

export const describeDocDBClusters = (region: string) =>
  Effect.tryPromise({
    try: async () => {
      const client = new DocDBClient({ region, credentials: makeCredentials() });
      const resp = await client.send(new DocDBDescribeDBClustersCommand({}));
      return (resp.DBClusters || []).map(
        (cluster): DocDBCluster => ({
          id: cluster.DBClusterIdentifier || "unknown",
          arn: cluster.DBClusterArn,
          status: cluster.Status,
          engine: cluster.Engine,
        }),
      );
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });

export const describeNeptuneClusters = (region: string) =>
  Effect.tryPromise({
    try: async () => {
      const client = new NeptuneClient({ region, credentials: makeCredentials() });
      const resp = await client.send(new NeptuneDescribeDBClustersCommand({}));
      return (resp.DBClusters || []).map(
        (cluster): NeptuneCluster => ({
          id: cluster.DBClusterIdentifier || "unknown",
          arn: cluster.DBClusterArn,
          status: cluster.Status,
        }),
      );
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });

export const describeElasticBeanstalkEnvironments = (region: string) =>
  Effect.tryPromise({
    try: async () => {
      const client = new ElasticBeanstalkClient({ region, credentials: makeCredentials() });
      const resp = await client.send(new DescribeEnvironmentsCommand({}));
      return (resp.Environments || []).map(
        (env): ElasticBeanstalkEnvironment => ({
          name: env.EnvironmentName || "unknown",
          id: env.EnvironmentId || "unknown",
          status: env.Status,
          health: env.Health,
          tier: env.Tier?.Name,
        }),
      );
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });

export const describeCloudFrontDistributions = () =>
  Effect.tryPromise({
    try: async () => {
      const client = new CloudFrontClient({ region: "us-east-1", credentials: makeCredentials() });
      const resp = await client.send(new ListDistributionsCommand({}));
      return (resp.DistributionList?.Items || []).map(
        (d): CloudFrontDistribution => ({
          id: d.Id || "unknown",
          domainName: d.DomainName || "unknown",
          status: d.Status || "UNKNOWN",
          enabled: d.Enabled || false,
        }),
      );
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });

export const describeRoute53HostedZones = () =>
  Effect.tryPromise({
    try: async () => {
      const client = new Route53Client({ region: "us-east-1", credentials: makeCredentials() });
      const zones: Route53HostedZone[] = [];
      let marker: string | undefined;
      do {
        const resp = await client.send(new ListHostedZonesCommand({ Marker: marker }));
        for (const z of resp.HostedZones || []) {
          zones.push({
            id: z.Id || "unknown",
            name: z.Name || "unknown",
            privateZone: z.Config?.PrivateZone || false,
          });
        }
        marker = resp.IsTruncated ? resp.NextMarker : undefined;
      } while (marker);
      return zones;
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });

export const describeGlobalAccelerators = () =>
  Effect.tryPromise({
    try: async () => {
      const client = new GlobalAcceleratorClient({
        region: "us-west-2",
        credentials: makeCredentials(),
      });
      const resp = await client.send(new ListAcceleratorsCommand({}));
      return (resp.Accelerators || []).map(
        (a): GlobalAccelerator => ({
          name: a.Name || "unknown",
          arn: a.AcceleratorArn,
          status: a.Status,
        }),
      );
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });
