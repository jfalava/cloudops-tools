import { Cause, Effect, Exit, Ref } from "effect";
import { mkdir } from "node:fs/promises";

import { InventoryDbService } from "../lib/inventory-db";
import {
  progressEmitter,
  createProgressEvent,
  ProgressEventType,
  type StartedEvent,
  type ProgressEvent,
  type ServiceStartedEvent,
  type ServiceCompletedEvent,
  type ServiceFailedEvent,
  type FileWrittenEvent,
  type CompletedEvent,
  type FailedEvent,
} from "../lib/progress-events";
import { writeInventoryFile } from "../lib/spreadsheet";
import {
  getEKSVersionStatus,
  getLambdaRuntimeStatus,
  getRDSEngineVersionStatus,
  getElastiCacheVersionStatus,
} from "../lib/version-checker";
import {
  UtilService,
  ComputeService,
  StorageService,
  DatabaseService,
  NetworkingService,
  SecurityService,
  DeveloperToolsService,
  ManagementService,
  GovernanceService,
  AppIntegrationService,
} from "../services";

export type InventoryMode = "basic" | "detailed" | "security" | "cost";

export interface ConsolidatedResource {
  type: string;
  name: string;
  region: string;
  arn: string;
  state?: string;
  tags?: string;
  createdDate?: string;
  publicAccess?: string;
  size?: string;
  encrypted?: string;
  vpcId?: string;
  lastActivity?: string;
  versionStatus?: string;
}

function tagsToString(tags?: Record<string, string>): string | undefined {
  if (!tags || Object.keys(tags).length === 0) {
    return undefined;
  }
  return JSON.stringify(tags);
}

const getCSVHeader = (mode: InventoryMode): string => {
  switch (mode) {
    case "basic":
      return "Type,Name,Region,ARN";
    case "detailed":
      return "Type,Name,Region,ARN,State,Tags,CreatedDate,PublicAccess,Size";
    case "security":
      return "Type,Name,Region,ARN,State,Encrypted,PublicAccess,VPC,VersionStatus";
    case "cost":
      return "Type,Name,Region,ARN,State,Size,CreatedDate,LastActivity";
  }
};

const resourceToCSVRow = (resource: ConsolidatedResource, mode: InventoryMode): string => {
  const escapeCSV = (value: string | undefined): string => {
    if (!value) {
      return "N/A";
    }
    return value.includes(",") || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value;
  };

  const baseFields = [resource.type, escapeCSV(resource.name), resource.region, resource.arn];

  switch (mode) {
    case "basic":
      return baseFields.join(",");
    case "detailed":
      return [
        ...baseFields,
        escapeCSV(resource.state),
        escapeCSV(resource.tags),
        escapeCSV(resource.createdDate),
        escapeCSV(resource.publicAccess),
        escapeCSV(resource.size),
      ].join(",");
    case "security":
      return [
        ...baseFields,
        escapeCSV(resource.state),
        escapeCSV(resource.encrypted),
        escapeCSV(resource.publicAccess),
        escapeCSV(resource.vpcId),
        escapeCSV(resource.versionStatus),
      ].join(",");
    case "cost":
      return [
        ...baseFields,
        escapeCSV(resource.state),
        escapeCSV(resource.size),
        escapeCSV(resource.createdDate),
        escapeCSV(resource.lastActivity),
      ].join(",");
  }
};

/**
 * Orchestrates the comprehensive cross-region inventory scan.
 */
export const ALL_REGIONAL_SERVICES = [
  "EC2",
  "RDS",
  "Lambda",
  "VPC",
  "Subnet",
  "SecurityGroup",
  "LoadBalancer",
  "ECS",
  "EKS",
  "EBS",
  "EFS",
  "FSx",
  "ElastiCache",
  "DAX",
  "DocDB",
  "Neptune",
  "MemoryDB",
  "Timestream",
  "Keyspaces",
  "RedshiftServerless",
  "OpenSearchServerless",
  "SQS",
  "SNS",
  "ECR",
  "CloudWatch",
  "SSM",
  "KMS",
  "SecretsManager",
  "AppRunner",
  "Batch",
  "EMR",
  "EMRServerless",
  "Lightsail",
  "ElasticBeanstalk",
  "SageMaker",
  "APIGateway",
  "APIGatewayV2",
  "VpcLattice",
  "StorageGateway",
  "BackupGateway",
  "BackupVault",
  "Glacier",
  "Rbin",
] as const;

export const ALL_GLOBAL_SERVICES = [
  "S3",
  "IAMUser",
  "IAMRole",
  "CloudFront",
  "Route53",
  "Route53Domains",
  "GlobalAccelerator",
  "DirectConnect",
  "SCP",
] as const;

export type RegionalService = (typeof ALL_REGIONAL_SERVICES)[number];
export type GlobalService = (typeof ALL_GLOBAL_SERVICES)[number];
export type ServiceName = RegionalService | GlobalService;

export const generateInitInventoryEffect = (
  accountId: string,
  mode: InventoryMode = "basic",
  format: string = "csv",
  limitRegions?: string[],
  debug: boolean = false,
  options?: {
    readonly skipGlobal?: boolean;
    readonly onlyGlobal?: boolean;
    readonly services?: string[];
    readonly skipDb?: boolean;
    readonly incremental?: boolean;
  },
) =>
  // This orchestrator intentionally branches on mode/service/region to keep progress and output wiring in one place.
  // eslint-disable-next-line complexity
  Effect.gen(function* (_) {
    const runStart = Date.now();
    const utils = yield* _(UtilService);
    const compute = yield* _(ComputeService);
    const storage = yield* _(StorageService);
    const database = yield* _(DatabaseService);
    const networking = yield* _(NetworkingService);
    const security = yield* _(SecurityService);
    const management = yield* _(ManagementService);
    const governance = yield* _(GovernanceService);
    const developer = yield* _(DeveloperToolsService);
    const appInt = yield* _(AppIntegrationService);

    let regions: string[];
    if (limitRegions && limitRegions.length > 0) {
      regions = limitRegions;
    } else {
      regions = yield* _(utils.getAllRegions());
    }

    if (options?.onlyGlobal) {
      regions = [];
    }

    const serviceFilter = options?.services?.map((s) => s.toUpperCase());
    const shouldRunService = (service: string): boolean => {
      if (!serviceFilter || serviceFilter.length === 0) {
        return true;
      }
      return serviceFilter.includes(service.toUpperCase());
    };

    const regionalServices = ALL_REGIONAL_SERVICES.filter(shouldRunService);
    const globalServices = ALL_GLOBAL_SERVICES.filter(shouldRunService);
    const totalTasks =
      regions.length * regionalServices.length + (options?.skipGlobal ? 0 : globalServices.length);
    const completedRef = yield* _(Ref.make(0));

    progressEmitter.emitProgress(
      createProgressEvent<StartedEvent>(ProgressEventType.STARTED, {
        account: accountId,
        region: regions.join(","),
        services: [...regionalServices, ...globalServices],
        mode,
      }),
    );

    const emitProgressUpdate = (service: string, region: string) =>
      Effect.gen(function* (__) {
        const completed = yield* __(Ref.updateAndGet(completedRef, (n) => n + 1));
        const percentage = totalTasks === 0 ? 100 : Math.floor((completed / totalTasks) * 100);
        progressEmitter.emitProgress(
          createProgressEvent<ProgressEvent>(ProgressEventType.PROGRESS, {
            percentage,
            message: `${service} ${region}`,
            completed,
            total: totalTasks,
          }),
        );
      });

    const runService = <A>(
      service: string,
      region: string,
      effect: Effect.Effect<A, unknown>,
      countResources: (result: A) => number = (result) =>
        Array.isArray(result) ? result.length : 0,
    ): Effect.Effect<A, unknown> =>
      Effect.gen(function* (__) {
        const startedAt = Date.now();
        progressEmitter.emitProgress(
          createProgressEvent<ServiceStartedEvent>(ProgressEventType.SERVICE_STARTED, {
            service,
            region,
          }),
        );

        const exit = yield* __(Effect.exit(effect));
        const duration = Date.now() - startedAt;

        if (Exit.isSuccess(exit)) {
          const resourceCount = countResources(exit.value);
          progressEmitter.emitProgress(
            createProgressEvent<ServiceCompletedEvent>(ProgressEventType.SERVICE_COMPLETED, {
              service,
              region,
              resourceCount,
              duration,
            }),
          );
          yield* __(emitProgressUpdate(service, region));
          return exit.value;
        }

        const failure = Cause.failureOption(exit.cause);
        const error = debug
          ? String(exit.cause)
          : failure._tag === "Some"
            ? failure.value instanceof Error
              ? failure.value.message
              : String(failure.value)
            : "Unknown error";
        progressEmitter.emitProgress(
          createProgressEvent<ServiceFailedEvent>(ProgressEventType.SERVICE_FAILED, {
            service,
            region,
            error,
          }),
        );
        yield* __(emitProgressUpdate(service, region));
        return [] as unknown as A;
      });

    const runServiceIf = <A>(
      service: string,
      region: string,
      effect: Effect.Effect<A, unknown>,
      countResources?: (result: A) => number,
    ): Effect.Effect<A, unknown> =>
      shouldRunService(service)
        ? runService(service, region, effect, countResources)
        : Effect.succeed([] as unknown as A);

    // Regional scans
    const regionalResults =
      regions.length === 0
        ? []
        : yield* _(
            Effect.forEach(
              regions,
              (region) =>
                Effect.all(
                  [
                    runServiceIf(
                      "EC2",
                      region,
                      compute.describeEC2(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "EC2",
                                name: r.name !== "N/A" ? r.name : r.id,
                                region,
                                arn: `arn:aws:ec2:${region}:${accountId}:instance/${r.id}`,
                                state: r.state,
                                tags: tagsToString(r.tags),
                                createdDate: r.launchTime,
                                publicAccess: r.publicIp !== "N/A" ? "Public" : "Private",
                                size: r.type,
                                vpcId: r.vpcId,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "RDS",
                      region,
                      database.describeRDS(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "RDS",
                                name: r.name !== "N/A" ? r.name : r.id,
                                region,
                                arn: `arn:aws:rds:${region}:${accountId}:db:${r.id}`,
                                state: r.status,
                                tags: tagsToString(r.tags),
                                createdDate: r.createTime,
                                publicAccess: r.publiclyAccessible ? "Public" : "Private",
                                size: r.instanceClass,
                                encrypted: r.encrypted ? "Yes" : "No",
                                vpcId: r.vpcId,
                                versionStatus:
                                  mode === "security"
                                    ? getRDSEngineVersionStatus(r.engine, r.engineVersion)
                                    : undefined,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "Lambda",
                      region,
                      compute.describeLambda(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "Lambda",
                                name: r.name,
                                region,
                                arn: `arn:aws:lambda:${region}:${accountId}:function:${r.name}`,
                                state: r.runtime,
                                tags: tagsToString(r.tags),
                                createdDate: r.lastModified,
                                size: `${r.memorySize}MB`,
                                vpcId: r.vpcId,
                                versionStatus:
                                  mode === "security"
                                    ? getLambdaRuntimeStatus(r.runtime)
                                    : undefined,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "VPC",
                      region,
                      networking.describeVPCs(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "VPC",
                                name: r.name !== "N/A" ? r.name : r.id,
                                region,
                                arn: `arn:aws:ec2:${region}:${accountId}:vpc/${r.id}`,
                                state: r.state,
                                tags: tagsToString(r.tags),
                                size: r.cidr,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "Subnet",
                      region,
                      networking.describeSubnets(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "Subnet",
                                name: r.name !== "N/A" ? r.name : r.id,
                                region,
                                arn: `arn:aws:ec2:${region}:${accountId}:subnet/${r.id}`,
                                state: r.state,
                                tags: tagsToString(r.tags),
                                size: r.cidr,
                                publicAccess: r.mapPublicIpOnLaunch ? "Auto-Public" : "Private",
                                vpcId: r.vpcId,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "SecurityGroup",
                      region,
                      networking.describeSecurityGroups(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "SecurityGroup",
                                name: r.name,
                                region,
                                arn: `arn:aws:ec2:${region}:${accountId}:security-group/${r.id}`,
                                state: `${r.ingressRulesCount} in / ${r.egressRulesCount} out`,
                                tags: tagsToString(r.tags),
                                vpcId: r.vpcId,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "LoadBalancer",
                      region,
                      networking.describeLoadBalancers(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "LoadBalancer",
                                name: r.name,
                                region,
                                arn: r.arn || "",
                                state: r.state,
                                tags: tagsToString(r.tags),
                                createdDate: r.createdTime,
                                publicAccess:
                                  r.scheme === "internet-facing" ? "Public" : "Internal",
                                size: r.type,
                                vpcId: r.vpcId,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "ECS",
                      region,
                      compute.describeECS(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "ECS",
                                name: r.name,
                                region,
                                arn: `arn:aws:ecs:${region}:${accountId}:cluster/${r.name}`,
                                state: r.status,
                                tags: tagsToString(r.tags),
                                size: `${r.activeServicesCount} services`,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "EKS",
                      region,
                      compute.describeEKS(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "EKS",
                                name: r.name,
                                region,
                                arn: r.arn || "",
                                state: r.status,
                                tags: tagsToString(r.tags),
                                createdDate: r.createdAt,
                                publicAccess: r.endpoint ? "Has Endpoint" : undefined,
                                versionStatus:
                                  mode === "security" ? getEKSVersionStatus(r.version) : undefined,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "AppRunner",
                      region,
                      compute.describeAppRunnerServices(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "AppRunner",
                                name: r.name,
                                region,
                                arn: r.arn,
                                state: r.status,
                                createdDate: r.createdAt,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "Batch",
                      region,
                      compute.describeBatchComputeEnvironments(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "Batch",
                                name: r.name,
                                region,
                                arn: r.arn,
                                state: r.status,
                                size: r.type,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "EMR",
                      region,
                      compute.describeEMRClusters(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "EMR",
                                name: r.name,
                                region,
                                arn: `arn:aws:elasticmapreduce:${region}:${accountId}:cluster/${r.id}`,
                                state: r.status,
                                createdDate: r.creationDateTime,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "EMRServerless",
                      region,
                      compute.describeEMRServerlessApplications(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "EMRServerless",
                                name: r.name || r.id,
                                region,
                                arn: `arn:aws:emr-serverless:${region}:${accountId}:applications/${r.id}`,
                                state: r.status,
                                createdDate: r.createdAt,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "Lightsail",
                      region,
                      compute.describeLightsailInstances(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "Lightsail",
                                name: r.name,
                                region,
                                arn: r.arn || "",
                                state: r.state,
                                createdDate: r.createdAt,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "ElasticBeanstalk",
                      region,
                      compute.describeElasticBeanstalkEnvironments(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "ElasticBeanstalk",
                                name: r.name,
                                region,
                                arn: `arn:aws:elasticbeanstalk:${region}:${accountId}:environment/${r.id}`,
                                state: r.status,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "SageMaker",
                      region,
                      compute.describeSageMakerDomains(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "SageMaker",
                                name: r.name,
                                region,
                                arn: `arn:aws:sagemaker:${region}:${accountId}:domain/${r.id}`,
                                state: r.status,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "EBS",
                      region,
                      storage.describeEBS(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "EBS",
                                name: r.name !== "N/A" ? r.name : r.volumeId,
                                region,
                                arn: `arn:aws:ec2:${region}:${accountId}:volume/${r.volumeId}`,
                                state: r.state,
                                tags: tagsToString(r.tags),
                                createdDate: r.createTime,
                                size: `${r.size}GB`,
                                encrypted: r.encrypted ? "Yes" : "No",
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "EFS",
                      region,
                      storage.describeEFS(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "EFS",
                                name: r.name || r.fileSystemId,
                                region,
                                arn: `arn:aws:elasticfilesystem:${region}:${accountId}:file-system/${r.fileSystemId}`,
                                state: r.lifeCycleState,
                                tags: tagsToString(r.tags),
                                createdDate: r.creationTime,
                                size: r.sizeInBytes ? `${r.sizeInBytes}B` : undefined,
                                encrypted: r.encrypted ? "Yes" : "No",
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "FSx",
                      region,
                      storage.describeFSx(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "FSx",
                                name: r.id,
                                region,
                                arn:
                                  r.arn || `arn:aws:fsx:${region}:${accountId}:file-system/${r.id}`,
                                state: r.type,
                                size: r.storageCapacity ? `${r.storageCapacity}GB` : undefined,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "ElastiCache",
                      region,
                      database.describeElastiCache(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "ElastiCache",
                                name: r.cacheClusterId,
                                region,
                                arn: `arn:aws:elasticache:${region}:${accountId}:cluster:${r.cacheClusterId}`,
                                state: r.cacheClusterStatus,
                                createdDate: r.cacheClusterCreateTime,
                                size: r.cacheNodeType,
                                versionStatus:
                                  mode === "security"
                                    ? getElastiCacheVersionStatus(r.engine, r.engineVersion)
                                    : undefined,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "DAX",
                      region,
                      database.describeDAX(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "DAX",
                                name: r.name,
                                region,
                                arn: r.arn || "",
                                state: r.status,
                                size: r.nodeType,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "DocDB",
                      region,
                      database.describeDocDB(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "DocDB",
                                name: r.id,
                                region,
                                arn: r.arn || "",
                                state: r.status,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "Neptune",
                      region,
                      database.describeNeptune(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "Neptune",
                                name: r.id,
                                region,
                                arn: r.arn || "",
                                state: r.status,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "MemoryDB",
                      region,
                      database.describeMemoryDB(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "MemoryDB",
                                name: r.name,
                                region,
                                arn: r.arn || "",
                                state: r.status,
                                size: r.nodeType,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "Timestream",
                      region,
                      database.describeTimestreamDatabases(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "Timestream",
                                name: r.name,
                                region,
                                arn: r.arn || "",
                                state: r.status,
                                createdDate: r.createdAt,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "Keyspaces",
                      region,
                      database.describeKeyspaces(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "Keyspaces",
                                name: r.name,
                                region,
                                arn: r.arn || "",
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "RedshiftServerless",
                      region,
                      database.describeRedshiftServerlessNamespaces(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "RedshiftServerless",
                                name: r.name,
                                region,
                                arn: r.arn || "",
                                state: r.status,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "OpenSearchServerless",
                      region,
                      database.describeOpenSearchServerlessCollections(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "OpenSearchServerless",
                                name: r.name,
                                region,
                                arn: r.id || "",
                                state: r.status,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "SQS",
                      region,
                      appInt.describeSQSQueues(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "SQS",
                                name: r.queueName,
                                region,
                                arn: r.queueUrl,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "SNS",
                      region,
                      appInt.describeSNSTopics(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "SNS",
                                name: r.topicName,
                                region,
                                arn: r.topicArn,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "ECR",
                      region,
                      developer.describeECRRepositories(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "ECR",
                                name: r.repositoryName,
                                region,
                                arn: r.repositoryArn,
                                createdDate: r.createdAt,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "APIGateway",
                      region,
                      management.describeAPIGateways(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "APIGateway",
                                name: r.name,
                                region,
                                arn: r.id,
                                state: r.protocolType,
                                createdDate: r.createdDate,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "APIGatewayV2",
                      region,
                      management.describeAPIGatewaysV2(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "APIGatewayV2",
                                name: r.name,
                                region,
                                arn: r.id,
                                state: r.protocolType,
                                publicAccess: r.apiEndpoint ? "Has Endpoint" : undefined,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "VpcLattice",
                      region,
                      networking.describeVpcLatticeServices(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "VpcLattice",
                                name: r.name,
                                region,
                                arn: r.arn || r.id,
                                state: r.status,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "CloudWatch",
                      region,
                      management.describeCloudWatchAlarms(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "CloudWatch",
                                name: r.alarmName,
                                region,
                                arn: `arn:aws:cloudwatch:${region}:${accountId}:alarm:${r.alarmName}`,
                                state: r.stateValue,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "SSM",
                      region,
                      management.describeSSMParameters(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "SSM",
                                name: r.name,
                                region,
                                arn: r.arn || "",
                                state: `v${r.version}`,
                                lastActivity: r.lastModifiedDate,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "KMS",
                      region,
                      security.describeKMSKeys(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "KMS",
                                name: r.keyId,
                                region,
                                arn: r.keyArn,
                                state: r.keyState,
                                createdDate: r.creationDate,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "SecretsManager",
                      region,
                      security.describeSecretsManagerSecrets(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "SecretsManager",
                                name: r.name,
                                region,
                                arn: r.secretArn,
                                createdDate: r.createdDate,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "BackupVault",
                      region,
                      storage.describeBackup(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "BackupVault",
                                name: r.backupVaultName,
                                region,
                                arn: r.backupVaultArn,
                                createdDate: r.creationDate,
                                state: r.locked ? "Locked" : "Unlocked",
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "StorageGateway",
                      region,
                      storage.describeStorageGateways(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "StorageGateway",
                                name: r.id,
                                region,
                                arn: r.arn || "",
                                state: r.state,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "BackupGateway",
                      region,
                      storage.describeBackupGateways(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "BackupGateway",
                                name: r.name,
                                region,
                                arn: r.arn || "",
                                state: r.state,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "Glacier",
                      region,
                      storage.describeGlacierVaults(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "Glacier",
                                name: r.name,
                                region,
                                arn: r.arn || "",
                                createdDate: r.creationDate,
                                size: r.numberOfArchives
                                  ? `${r.numberOfArchives} archives`
                                  : undefined,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),

                    runServiceIf(
                      "Rbin",
                      region,
                      storage.describeRbinRules(region).pipe(
                        Effect.map((rs) =>
                          rs.map(
                            (r) =>
                              ({
                                type: "Rbin",
                                name: r.id,
                                region,
                                arn: r.arn || "",
                                state: r.status,
                              }) as ConsolidatedResource,
                          ),
                        ),
                      ),
                    ),
                  ],
                  { concurrency: 10 },
                ).pipe(Effect.map((rs) => rs.flat())),
              { concurrency: 5 },
            ),
          );

    // Global Services
    const globalResources = options?.skipGlobal
      ? []
      : yield* _(
          Effect.all(
            [
              runServiceIf(
                "S3",
                "global",
                storage.describeS3().pipe(
                  Effect.map((rs) =>
                    rs.map(
                      (r) =>
                        ({
                          type: "S3",
                          name: r.name,
                          region: "global",
                          arn: `arn:aws:s3:::${r.name}`,
                          state: r.versioningEnabled ? "Versioned" : "Unversioned",
                          tags: tagsToString(r.tags),
                          createdDate: r.creationDate,
                          publicAccess: r.publicAccess ? "Public" : "Private",
                          encrypted: r.encrypted ? "Yes" : "No",
                        }) as ConsolidatedResource,
                    ),
                  ),
                ),
              ),

              runServiceIf(
                "IAMUser",
                "global",
                security.describeIAMUsers().pipe(
                  Effect.map((rs) =>
                    rs.map(
                      (r) =>
                        ({
                          type: "IAMUser",
                          name: r.userName,
                          region: "global",
                          arn: r.arn,
                          createdDate: r.createDate,
                        }) as ConsolidatedResource,
                    ),
                  ),
                ),
              ),

              runServiceIf(
                "IAMRole",
                "global",
                security.describeIAMRoles().pipe(
                  Effect.map((rs) =>
                    rs.map(
                      (r) =>
                        ({
                          type: "IAMRole",
                          name: r.roleName,
                          region: "global",
                          arn: r.arn,
                          createdDate: r.createDate,
                        }) as ConsolidatedResource,
                    ),
                  ),
                ),
              ),

              runServiceIf(
                "CloudFront",
                "global",
                management.describeCloudFrontDistributions().pipe(
                  Effect.map((rs) =>
                    rs.map(
                      (r) =>
                        ({
                          type: "CloudFront",
                          name: r.domainName,
                          region: "global",
                          arn: r.id,
                          state: r.status,
                        }) as ConsolidatedResource,
                    ),
                  ),
                ),
              ),

              runServiceIf(
                "Route53",
                "global",
                management.describeRoute53HostedZones().pipe(
                  Effect.map((rs) =>
                    rs.map(
                      (r) =>
                        ({
                          type: "Route53",
                          name: r.name,
                          region: "global",
                          arn: r.id,
                          state: r.privateZone ? "Private" : "Public",
                        }) as ConsolidatedResource,
                    ),
                  ),
                ),
              ),

              runServiceIf(
                "Route53Domains",
                "global",
                management.describeRoute53Domains().pipe(
                  Effect.map((rs) =>
                    rs.map(
                      (r) =>
                        ({
                          type: "Route53Domains",
                          name: r.domainName,
                          region: "global",
                          arn: r.domainName,
                          state: r.transferLock ? "Locked" : "Unlocked",
                        }) as ConsolidatedResource,
                    ),
                  ),
                ),
              ),

              runServiceIf(
                "GlobalAccelerator",
                "global",
                networking.describeGlobalAccelerators("us-east-1").pipe(
                  Effect.map((rs) =>
                    rs.map(
                      (r) =>
                        ({
                          type: "GlobalAccelerator",
                          name: r.name,
                          region: "global",
                          arn: r.arn || "",
                          state: r.status,
                        }) as ConsolidatedResource,
                    ),
                  ),
                ),
              ),

              runServiceIf(
                "DirectConnect",
                "global",
                networking.describeDirectConnectConnections("us-east-1").pipe(
                  Effect.map((rs) =>
                    rs.map(
                      (r) =>
                        ({
                          type: "DirectConnect",
                          name: r.name || r.id,
                          region: "global",
                          arn: r.id,
                          state: r.state,
                        }) as ConsolidatedResource,
                    ),
                  ),
                ),
              ),

              runServiceIf(
                "SCP",
                "global",
                governance.describeServiceControlPolicies().pipe(
                  Effect.map((rs) =>
                    rs.map(
                      (r) =>
                        ({
                          type: "SCP",
                          name: r.name,
                          region: "global",
                          arn: r.arn,
                          state: r.type,
                        }) as ConsolidatedResource,
                    ),
                  ),
                ),
              ),
            ],
            { concurrency: 5 },
          ).pipe(Effect.map((rs) => rs.flat())),
        );

    const allResources = [...regionalResults.flat(), ...globalResources];

    // Incremental scanning: filter to only new/changed resources
    let resourcesToOutput = allResources;
    let incrementalStats:
      | {
          newCount: number;
          changedCount: number;
          unchangedCount: number;
          removedCount: number;
        }
      | undefined = undefined;

    if (options?.incremental && !options.skipDb) {
      const db = yield* _(InventoryDbService);
      yield* _(db.initialize());

      const incremental = yield* _(db.getIncrementalChanges(accountId, allResources));

      incrementalStats = {
        newCount: incremental.newResources.length,
        changedCount: incremental.changedResources.length,
        unchangedCount: incremental.unchangedCount,
        removedCount: incremental.removedCount,
      };

      resourcesToOutput = [...incremental.newResources, ...incremental.changedResources];

      progressEmitter.emitProgress(
        createProgressEvent<ProgressEvent>(ProgressEventType.PROGRESS, {
          percentage: 95,
          message: `Incremental: ${incrementalStats.newCount} new, ${incrementalStats.changedCount} changed, ${incrementalStats.unchangedCount} unchanged`,
          completed: totalTasks,
          total: totalTasks,
        }),
      );
    }

    // Writing output
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const outputDir = `inventory-output/${accountId}`;
    const modePrefix = options?.incremental
      ? `init-incremental`
      : mode === "basic"
        ? "init"
        : `init-${mode}`;
    const basePath = `${outputDir}/${modePrefix}-${accountId}-${timestamp}`;

    const csvHeader = getCSVHeader(mode) + "\n";
    const csvRows = resourcesToOutput.map((r) => resourceToCSVRow(r, mode)).join("\n");
    yield* _(Effect.promise(() => mkdir(outputDir, { recursive: true })));

    if (resourcesToOutput.length > 0) {
      yield* _(
        Effect.promise(() =>
          writeInventoryFile(csvHeader + csvRows, basePath, format, "Inventory"),
        ),
      );
    }

    const outputFiles: string[] = [];
    const shouldWriteCsv = format === "csv" || format === "both" || format === "all";
    const shouldWriteXlsx = format === "xlsx" || format === "both" || format === "all";

    if (resourcesToOutput.length > 0) {
      if (shouldWriteCsv) {
        const csvPath = basePath.endsWith(".csv") ? basePath : `${basePath}.csv`;
        outputFiles.push(csvPath);
        const size = Bun.file(csvPath).size;
        progressEmitter.emitProgress(
          createProgressEvent<FileWrittenEvent>(ProgressEventType.FILE_WRITTEN, {
            filePath: csvPath,
            format: "csv",
            size,
          }),
        );
      }

      if (shouldWriteXlsx) {
        const xlsxPath = basePath.endsWith(".csv")
          ? basePath.replace(/\.csv$/, ".xlsx")
          : `${basePath}.xlsx`;
        outputFiles.push(xlsxPath);
        const size = Bun.file(xlsxPath).size;
        progressEmitter.emitProgress(
          createProgressEvent<FileWrittenEvent>(ProgressEventType.FILE_WRITTEN, {
            filePath: xlsxPath,
            format: "xlsx",
            size,
          }),
        );
      }
    }

    const summary = allResources.reduce<Record<string, number>>((acc, resource) => {
      acc[resource.type] = (acc[resource.type] || 0) + 1;
      return acc;
    }, {});

    // Save to SQLite database
    if (!options?.skipDb) {
      const db = yield* _(InventoryDbService);
      yield* _(db.initialize());
      yield* _(db.saveRun(accountId, mode, allResources));
      yield* _(db.updateFingerprints(accountId, allResources));
    }

    progressEmitter.emitProgress(
      createProgressEvent<CompletedEvent>(ProgressEventType.COMPLETED, {
        totalResources: allResources.length,
        duration: Date.now() - runStart,
        outputFiles,
        summary,
        incremental: incrementalStats,
      }),
    );

    return allResources;
  }).pipe(
    Effect.tapError((error) =>
      Effect.sync(() => {
        progressEmitter.emitProgress(
          createProgressEvent<FailedEvent>(ProgressEventType.FAILED, {
            error: String(error),
            stack: error instanceof Error ? error.stack : undefined,
          }),
        );
      }),
    ),
  );
