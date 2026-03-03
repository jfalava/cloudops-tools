import type {
  EC2Instance,
  LambdaFunction,
  ECSCluster,
  EKSCluster,
  AutoScalingGroup,
  AppRunnerService,
  BatchComputeEnvironment,
  EMRCluster,
  EMRServerlessApplication,
  LightsailInstance,
  ElasticBeanstalkEnvironment,
  SageMakerDomain,
} from "@cloudops-tools/types/aws";
import * as AppRunner from "distilled-aws/apprunner";
import * as AutoScaling from "distilled-aws/auto-scaling";
import * as Batch from "distilled-aws/batch";
import * as EC2 from "distilled-aws/ec2";
import * as ECS from "distilled-aws/ecs";
import * as EKS from "distilled-aws/eks";
import * as EMR from "distilled-aws/emr";
import * as EMRServerless from "distilled-aws/emr-serverless";
import * as Lambda from "distilled-aws/lambda";
import * as Lightsail from "distilled-aws/lightsail";
import * as SageMaker from "distilled-aws/sagemaker";
import { Context, Effect, Stream, Layer } from "effect";

import { makeRegionConfig, AwsConfigLive } from "../lib/aws-config";
import { describeElasticBeanstalkEnvironments as patchedDescribeElasticBeanstalk } from "../patches";

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

const getDateIsoString = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const nested = value[key];
  return nested instanceof Date ? nested.toISOString() : undefined;
};

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

const findTagValue = (
  values: readonly unknown[],
  keyField: string,
  valueField: string,
  lookupKey: string,
): string | undefined => {
  const match = values.find((value) => isRecord(value) && value[keyField] === lookupKey);
  if (!isRecord(match)) {
    return undefined;
  }
  const tagValue = match[valueField];
  return typeof tagValue === "string" ? tagValue : undefined;
};

const toStringRecord = (value: unknown): Record<string, string> => {
  if (!isRecord(value)) {
    return {};
  }
  return Object.entries(value).reduce<Record<string, string>>((acc, [key, entry]) => {
    if (typeof entry === "string") {
      acc[key] = entry;
    }
    return acc;
  }, {});
};

export interface ComputeService {
  readonly describeEC2: (region: string) => Effect.Effect<EC2Instance[], unknown>;
  readonly getEC2Details: (region: string, instanceId: string) => Effect.Effect<unknown, unknown>;
  readonly describeLambda: (region: string) => Effect.Effect<LambdaFunction[], unknown>;
  readonly getLambdaDetails: (
    region: string,
    functionName: string,
  ) => Effect.Effect<unknown, unknown>;
  readonly describeECS: (region: string) => Effect.Effect<ECSCluster[], unknown>;
  readonly describeEKS: (region: string) => Effect.Effect<EKSCluster[], unknown>;
  readonly describeAutoScaling: (region: string) => Effect.Effect<AutoScalingGroup[], unknown>;
  readonly describeAppRunnerServices: (
    region: string,
  ) => Effect.Effect<AppRunnerService[], unknown>;
  readonly describeBatchComputeEnvironments: (
    region: string,
  ) => Effect.Effect<BatchComputeEnvironment[], unknown>;
  readonly describeEMRClusters: (region: string) => Effect.Effect<EMRCluster[], unknown>;
  readonly describeEMRServerlessApplications: (
    region: string,
  ) => Effect.Effect<EMRServerlessApplication[], unknown>;
  readonly describeLightsailInstances: (
    region: string,
  ) => Effect.Effect<LightsailInstance[], unknown>;
  readonly describeElasticBeanstalkEnvironments: (
    region: string,
  ) => Effect.Effect<ElasticBeanstalkEnvironment[], unknown>;
  readonly describeSageMakerDomains: (region: string) => Effect.Effect<SageMakerDomain[], unknown>;
}

export const ComputeService = Context.GenericTag<ComputeService>("@sdk/services/ComputeService");

export const ComputeServiceLive = Layer.succeed(
  ComputeService,
  ComputeService.of({
    describeEC2: (region: string) =>
      EC2.describeInstances.items({}).pipe(
        Stream.mapConcat((reservation) => getArray(reservation, "Instances")),
        Stream.map(
          (instance): EC2Instance => ({
            id: getString(instance, "InstanceId", "unknown") ?? "unknown",
            name: findTagValue(getArray(instance, "Tags"), "Key", "Value", "Name") ?? "N/A",
            state: getString(getRecord(instance, "State"), "Name", "unknown") ?? "unknown",
            type: getString(instance, "InstanceType", "unknown") ?? "unknown",
            privateIp: getString(instance, "PrivateIpAddress", "N/A") ?? "N/A",
            publicIp: getString(instance, "PublicIpAddress", "N/A") ?? "N/A",
            vpcId: getString(instance, "VpcId", "N/A") ?? "N/A",
            launchTime: getDateIsoString(instance, "LaunchTime"),
            tags: toTagRecord(getArray(instance, "Tags"), "Key", "Value"),
          }),
        ),
        Stream.runCollect,
        Effect.map((chunk) => Array.from(chunk)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    getEC2Details: (region: string, instanceId: string) =>
      EC2.describeInstances({ InstanceIds: [instanceId] }).pipe(
        Effect.map((resp) => {
          const reservation = getArray(resp, "Reservations")[0];
          return getArray(reservation, "Instances")[0];
        }),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeLambda: (region: string) =>
      Lambda.listFunctions.items({}).pipe(
        Stream.map(
          (fn): LambdaFunction => ({
            name: getString(fn, "FunctionName", "unknown") ?? "unknown",
            runtime: getString(fn, "Runtime", "unknown") ?? "unknown",
            handler: getString(fn, "Handler", "unknown") ?? "unknown",
            lastModified: getString(fn, "LastModified", "N/A") ?? "N/A",
            memorySize: getNumber(fn, "MemorySize"),
            timeout: getNumber(fn, "Timeout"),
            vpcId: getString(getRecord(fn, "VpcConfig"), "VpcId"),
            tags: {},
          }),
        ),
        Stream.runCollect,
        Effect.map((chunk) => Array.from(chunk)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    getLambdaDetails: (region: string, functionName: string) =>
      Lambda.getFunction({ FunctionName: functionName }).pipe(
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeECS: (region: string) =>
      Effect.gen(function* (_) {
        const config = makeRegionConfig(region);

        const clusterArns = yield* _(
          ECS.listClusters.items({}).pipe(
            Stream.runCollect,
            Effect.map((chunk) =>
              Array.from(chunk).filter(
                (clusterArn): clusterArn is string => typeof clusterArn === "string",
              ),
            ),
            Effect.provide(config),
            Effect.provide(AwsConfigLive),
          ),
        );

        if (clusterArns.length === 0) {
          return [];
        }

        const batches = [];
        for (let i = 0; i < clusterArns.length; i += 100) {
          batches.push(clusterArns.slice(i, i + 100));
        }

        const clusters = yield* _(
          Effect.forEach(
            batches,
            (batch) =>
              ECS.describeClusters({ clusters: batch, include: ["TAGS"] }).pipe(
                Effect.provide(config),
                Effect.provide(AwsConfigLive),
              ),
            { concurrency: 3 },
          ),
        );

        return clusters.flatMap((resp) =>
          getArray(resp, "clusters").map(
            (cluster): ECSCluster => ({
              name: getString(cluster, "clusterName", "unknown") ?? "unknown",
              status: getString(cluster, "status", "UNKNOWN") ?? "UNKNOWN",
              registeredContainerInstancesCount: getNumber(
                cluster,
                "registeredContainerInstancesCount",
              ),
              runningTasksCount: getNumber(cluster, "runningTasksCount"),
              pendingTasksCount: getNumber(cluster, "pendingTasksCount"),
              activeServicesCount: getNumber(cluster, "activeServicesCount"),
              tags: toTagRecord(getArray(cluster, "tags"), "key", "value"),
            }),
          ),
        );
      }),

    describeEKS: (region: string) =>
      Effect.gen(function* (_) {
        const config = makeRegionConfig(region);

        const clusterNames = yield* _(
          EKS.listClusters.items({}).pipe(
            Stream.runCollect,
            Effect.map((chunk) =>
              Array.from(chunk).filter((name): name is string => typeof name === "string"),
            ),
            Effect.provide(config),
            Effect.provide(AwsConfigLive),
          ),
        );

        const clusters = yield* _(
          Effect.forEach(
            clusterNames,
            (name) =>
              EKS.describeCluster({ name }).pipe(
                Effect.provide(config),
                Effect.provide(AwsConfigLive),
              ),
            { concurrency: 5 },
          ),
        );

        return clusters
          .map((response) => getRecord(response, "cluster"))
          .filter((c): c is NonNullable<typeof c> => Boolean(c))
          .map(
            (c): EKSCluster => ({
              name: getString(c, "name", "unknown") ?? "unknown",
              status: getString(c, "status", "UNKNOWN") ?? "UNKNOWN",
              version: getString(c, "version", "unknown") ?? "unknown",
              arn: getString(c, "arn"),
              createdAt: getDateIsoString(c, "createdAt"),
              endpoint: getString(c, "endpoint"),
              tags: toStringRecord(getRecord(c, "tags")),
            }),
          );
      }),

    describeAutoScaling: (region: string) =>
      AutoScaling.describeAutoScalingGroups.items({}).pipe(
        Stream.map(
          (asg): AutoScalingGroup => ({
            autoScalingGroupName: getString(asg, "AutoScalingGroupName", "unknown") ?? "unknown",
            minSize: getNumber(asg, "MinSize"),
            maxSize: getNumber(asg, "MaxSize"),
            desiredCapacity: getNumber(asg, "DesiredCapacity"),
            availabilityZones: getArray(asg, "AvailabilityZones").filter(
              (zone): zone is string => typeof zone === "string",
            ),
            healthCheckType: getString(asg, "HealthCheckType", "UNKNOWN") ?? "UNKNOWN",
            createdTime: getDateIsoString(asg, "CreatedTime"),
            tags: toTagRecord(getArray(asg, "Tags"), "Key", "Value"),
          }),
        ),
        Stream.runCollect,
        Effect.map((chunk) => Array.from(chunk)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeAppRunnerServices: (region: string) =>
      AppRunner.listServices.items({}).pipe(
        Stream.map(
          (service): AppRunnerService => ({
            name: getString(service, "ServiceName", "unknown") ?? "unknown",
            arn: getString(service, "ServiceArn", "unknown") ?? "unknown",
            status: getString(service, "Status"),
            createdAt: getDateIsoString(service, "CreatedAt"),
          }),
        ),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeBatchComputeEnvironments: (region: string) =>
      Batch.describeComputeEnvironments.items({}).pipe(
        Stream.map(
          (computeEnvironment): BatchComputeEnvironment => ({
            name: getString(computeEnvironment, "computeEnvironmentName", "unknown") ?? "unknown",
            arn: getString(computeEnvironment, "computeEnvironmentArn", "unknown") ?? "unknown",
            state: getString(computeEnvironment, "state"),
            status: getString(computeEnvironment, "status"),
            type: getString(computeEnvironment, "type"),
          }),
        ),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeEMRClusters: (region: string) =>
      EMR.listClusters.items({}).pipe(
        Stream.map(
          (cluster): EMRCluster => ({
            id: getString(cluster, "Id", "unknown") ?? "unknown",
            name: getString(cluster, "Name", "unknown") ?? "unknown",
            status: getString(getRecord(cluster, "Status"), "State", "unknown") ?? "unknown",
            creationDateTime: getDateIsoString(
              getRecord(getRecord(cluster, "Status"), "Timeline"),
              "CreationDateTime",
            ),
          }),
        ),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeEMRServerlessApplications: (region: string) =>
      EMRServerless.listApplications.items({}).pipe(
        Stream.map(
          (application): EMRServerlessApplication => ({
            id: getString(application, "Id", "unknown") ?? "unknown",
            name: getString(application, "Name"),
            status: getString(application, "State"),
            releaseLabel: getString(application, "ReleaseLabel"),
            createdAt: getDateIsoString(application, "CreatedAt"),
          }),
        ),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeLightsailInstances: (region: string) =>
      Lightsail.getInstances({}).pipe(
        Effect.map((response) =>
          getArray(response, "Instances").map(
            (instance): LightsailInstance => ({
              name: getString(instance, "Name", "unknown") ?? "unknown",
              arn: getString(instance, "Arn"),
              state: getString(getRecord(instance, "State"), "Name"),
              blueprintId: getString(instance, "BlueprintId"),
              createdAt: getDateIsoString(instance, "CreatedAt"),
            }),
          ),
        ),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeElasticBeanstalkEnvironments: (region: string) =>
      patchedDescribeElasticBeanstalk(region),

    describeSageMakerDomains: (region: string) =>
      SageMaker.listDomains.items({}).pipe(
        Stream.map(
          (domain): SageMakerDomain => ({
            id: getString(domain, "DomainId", "unknown") ?? "unknown",
            name: getString(domain, "DomainName", "unknown") ?? "unknown",
            status: getString(domain, "Status"),
          }),
        ),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),
  }),
);
