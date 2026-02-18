import { Context, Effect, Layer } from "effect";
import json2md from "json2md";

import { asString, isObjectRecord, normalizeArray } from "../lib/aws-payload";

import {
  ComputeService,
  DatabaseService,
  NetworkingService,
  StorageService,
  ManagementService,
  SecurityService,
  GovernanceService,
  AppIntegrationService,
  DeveloperToolsService,
} from "./index";

export interface ReportingService {
  readonly generateMarkdownReport: (
    title: string,
    data: ReadonlyArray<unknown>,
  ) => Effect.Effect<string, unknown>;
  readonly describeResourceHarder: (
    type: string,
    region: string,
    id: string,
    debug?: boolean,
  ) => Effect.Effect<string, unknown>;
}

export const ReportingService = Context.GenericTag<ReportingService>(
  "@sdk/services/ReportingService",
);

export const ReportingServiceLive = Layer.effect(
  ReportingService,
  Effect.gen(function* (_) {
    const compute = yield* _(ComputeService);
    const database = yield* _(DatabaseService);
    const networking = yield* _(NetworkingService);
    const storage = yield* _(StorageService);
    const management = yield* _(ManagementService);
    const security = yield* _(SecurityService);
    const governance = yield* _(GovernanceService);
    const appIntegration = yield* _(AppIntegrationService);
    const developerTools = yield* _(DeveloperToolsService);

    const formatValue = (val: unknown): string => {
      if (val === null || val === undefined) {
        return "N/A";
      }
      if (typeof val === "string") {
        return val;
      }
      if (typeof val === "number" || typeof val === "boolean" || typeof val === "bigint") {
        return val.toString();
      }
      if (typeof val === "symbol") {
        return val.description ? `Symbol(${val.description})` : "Symbol()";
      }
      if (typeof val === "function") {
        return "[Function]";
      }
      if (typeof val === "object") {
        return JSON.stringify(val);
      }
      return "N/A";
    };

    const objectToTable = (obj: unknown) => {
      const entries = isObjectRecord(obj) ? Object.entries(obj) : [["Value", obj]];
      const rows = entries.map(([key, value]) => ({
        Property: key,
        Value: formatValue(value),
      }));
      return {
        table: {
          headers: ["Property", "Value"],
          rows: rows,
        },
      };
    };

    const findBy = <T extends object>(
      items: ReadonlyArray<T>,
      id: string,
      keys: ReadonlyArray<keyof T>,
    ): T | undefined => items.find((item) => keys.some((k) => String(item[k] ?? "") === id));

    type DescribeFinder = (region: string, id: string) => Effect.Effect<unknown, unknown>;

    const fromItems =
      <T extends object>(
        fetchItems: (region: string) => Effect.Effect<ReadonlyArray<T>, unknown>,
        keys: ReadonlyArray<keyof T>,
      ): DescribeFinder =>
      (region, id) =>
        fetchItems(region).pipe(Effect.map((items) => findBy(items, id, keys)));

    const fromGlobalItems =
      <T extends object>(
        fetchItems: () => Effect.Effect<ReadonlyArray<T>, unknown>,
        keys: ReadonlyArray<keyof T>,
      ): DescribeFinder =>
      (_region, id) =>
        fetchItems().pipe(Effect.map((items) => findBy(items, id, keys)));

    const describeFinders: Record<string, DescribeFinder> = {
      EC2: (region, id) => compute.getEC2Details(region, id),
      RDS: (region, id) => database.getRDSDetails(region, id),
      VPC: (region, id) => networking.getVPCDetails(region, id),
      LAMBDA: (region, id) => compute.getLambdaDetails(region, id),
      DYNAMODB: (region, id) => database.getDynamoDBDetails(region, id),
      APP_RUNNER: fromItems(compute.describeAppRunnerServices, ["name", "arn"]),
      APPRUNNER: fromItems(compute.describeAppRunnerServices, ["name", "arn"]),
      BATCH: fromItems(compute.describeBatchComputeEnvironments, ["name", "arn"]),
      EMR: fromItems(compute.describeEMRClusters, ["id", "name"]),
      EMRSERVERLESS: fromItems(compute.describeEMRServerlessApplications, ["id", "name"]),
      LIGHTSAIL: fromItems(compute.describeLightsailInstances, ["name", "arn"]),
      ELASTICBEANSTALK: fromItems(compute.describeElasticBeanstalkEnvironments, ["id", "name"]),
      SAGEMAKER: fromItems(compute.describeSageMakerDomains, ["id", "name"]),
      DAX: fromItems(database.describeDAX, ["name", "arn"]),
      DOCDB: fromItems(database.describeDocDB, ["id", "arn"]),
      NEPTUNE: fromItems(database.describeNeptune, ["id", "arn"]),
      MEMORYDB: fromItems(database.describeMemoryDB, ["name", "arn"]),
      TIMESTREAM: fromItems(database.describeTimestreamDatabases, ["name", "arn"]),
      KEYSPACES: fromItems(database.describeKeyspaces, ["name", "arn"]),
      REDSHIFTSERVERLESS: fromItems(database.describeRedshiftServerlessNamespaces, ["name", "arn"]),
      OPENSEARCHSERVERLESS: fromItems(database.describeOpenSearchServerlessCollections, [
        "name",
        "id",
      ]),
      EFS: fromItems(storage.describeEFS, ["fileSystemId", "name"]),
      FSX: fromItems(storage.describeFSx, ["id", "arn"]),
      BACKUPVAULT: fromItems(storage.describeBackup, ["backupVaultName", "backupVaultArn"]),
      STORAGEGATEWAY: fromItems(storage.describeStorageGateways, ["id", "arn"]),
      BACKUPGATEWAY: fromItems(storage.describeBackupGateways, ["name", "arn"]),
      GLACIER: fromItems(storage.describeGlacierVaults, ["name", "arn"]),
      RBIN: fromItems(storage.describeRbinRules, ["id", "arn"]),
      APIGATEWAY: fromItems(management.describeAPIGateways, ["id", "name"]),
      APIGATEWAYV2: fromItems(management.describeAPIGatewaysV2, ["id", "name"]),
      CLOUDFRONT: fromGlobalItems(management.describeCloudFrontDistributions, ["id", "domainName"]),
      ROUTE53: fromGlobalItems(management.describeRoute53HostedZones, ["id", "name"]),
      ROUTE53DOMAINS: fromGlobalItems(management.describeRoute53Domains, ["domainName"]),
      GLOBALACCELERATOR: fromItems(networking.describeGlobalAccelerators, ["name", "arn"]),
      DIRECTCONNECT: fromItems(networking.describeDirectConnectConnections, ["id", "name"]),
      VPCLATTICE: fromItems(networking.describeVpcLatticeServices, ["id", "name", "arn"]),
      S3: fromGlobalItems(storage.describeS3, ["name"]),
      IAMUSER: fromGlobalItems(security.describeIAMUsers, ["userName", "arn"]),
      IAMROLE: fromGlobalItems(security.describeIAMRoles, ["roleName", "arn"]),
      KMS: fromItems(security.describeKMSKeys, ["keyId", "keyArn"]),
      SECRETSMANAGER: fromItems(security.describeSecretsManagerSecrets, ["name", "secretArn"]),
      SQS: fromItems(appIntegration.describeSQSQueues, ["queueName", "queueUrl"]),
      SNS: fromItems(appIntegration.describeSNSTopics, ["topicName", "topicArn"]),
      ECR: fromItems(developerTools.describeECRRepositories, ["repositoryName", "repositoryArn"]),
      SCP: fromGlobalItems(governance.describeServiceControlPolicies, ["name", "arn"]),
    };

    return ReportingService.of({
      generateMarkdownReport: (title: string, data: ReadonlyArray<unknown>) =>
        Effect.sync(() => {
          const headers = Array.from(
            new Set(data.flatMap((row) => (isObjectRecord(row) ? Object.keys(row) : []))),
          );
          const rows = data.map((row) =>
            headers.map((key) => formatValue(isObjectRecord(row) ? row[key] : "")),
          );
          const content = [
            { h1: title },
            {
              table: {
                headers,
                rows,
              },
            },
          ];
          return json2md(content);
        }),

      describeResourceHarder: (type: string, region: string, id: string, debug?: boolean) =>
        Effect.gen(function* (__inner) {
          const normalizedType = type.toUpperCase();
          const finder = describeFinders[normalizedType];
          if (!finder) {
            return `Unsupported resource type for deep inspection: ${type}`;
          }

          const details = yield* __inner(finder(region, id));

          if (!details) {
            return `Resource not found: ${type} ${id} in ${region}`;
          }

          const report: Array<Record<string, unknown>> = [
            { h1: `Comprehensive Report: ${type} - ${id}` },
            { h2: "Core Details" },
            objectToTable(details),
          ];

          const networkInterfaces =
            isObjectRecord(details) && "NetworkInterfaces" in details
              ? normalizeArray(details.NetworkInterfaces)
              : [];

          if (normalizedType === "EC2" && networkInterfaces.length > 0) {
            report.push({ h2: "Network Interfaces" });
            networkInterfaces.forEach((ni, i: number) => {
              const interfaceId =
                isObjectRecord(ni) && asString(ni.NetworkInterfaceId)
                  ? asString(ni.NetworkInterfaceId)
                  : String(i + 1);
              report.push({ h3: `Interface ${i + 1} (${interfaceId})` });
              report.push(objectToTable(ni));
            });
          }

          return json2md(report);
        }).pipe(
          Effect.catchAll((error) =>
            debug
              ? Effect.fail(error)
              : Effect.sync(() => {
                  const message = error instanceof Error ? error.message : String(error);
                  return `INFO: Describe failed (${type} ${id} in ${region}). ${message}`;
                }),
          ),
        ),
    });
  }),
);
