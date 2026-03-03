import type {
  CloudWatchAlarm,
  CloudFrontDistribution,
  Route53HostedZone,
  CloudFormationStack,
  APIGateway as APIGatewayType,
  APIGatewayV2Api,
  StepFunction,
  EventBridgeRule,
  CloudTrail as CloudTrailType,
  SSMParameter,
  Route53Domain,
} from "@cloudops-tools/types/aws";
import * as APIGateway from "distilled-aws/api-gateway";
import * as APIGatewayV2 from "distilled-aws/apigatewayv2";
import * as CloudFormation from "distilled-aws/cloudformation";
import * as CloudTrail from "distilled-aws/cloudtrail";
import * as CloudWatch from "distilled-aws/cloudwatch";
import * as EventBridge from "distilled-aws/eventbridge";
import * as Route53Domains from "distilled-aws/route-53-domains";
import * as SFN from "distilled-aws/sfn";
import * as SSM from "distilled-aws/ssm";
import { Context, Effect, Stream, Layer } from "effect";

import { makeRegionConfig, AwsConfigLive } from "../lib/aws-config";
import {
  describeCloudFrontDistributions as patchedCloudFront,
  describeRoute53HostedZones as patchedRoute53,
} from "../patches";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

const getString = (record: UnknownRecord, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
};

const getBoolean = (record: UnknownRecord, key: string): boolean | undefined => {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
};

const getNumber = (record: UnknownRecord, key: string): number | undefined => {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
};

const getArray = (record: UnknownRecord, key: string): unknown[] => {
  const value = record[key];
  return Array.isArray(value) ? value : [];
};

const getRecord = (record: UnknownRecord, key: string): UnknownRecord | undefined => {
  const value = record[key];
  return isRecord(value) ? value : undefined;
};

const getDateISOString = (record: UnknownRecord, key: string): string | undefined => {
  const value = record[key];
  return value instanceof Date ? value.toISOString() : undefined;
};

const mapTags = (value: unknown): Record<string, string> => {
  const tags: Record<string, string> = {};
  const entries: unknown[] = Array.isArray(value) ? value : [];
  for (const entry of entries) {
    const tag = asRecord(entry);
    const key = getString(tag, "Key");
    if (key) {
      tags[key] = getString(tag, "Value") ?? "";
    }
  }
  return tags;
};

const toStringRecord = (value: unknown): Record<string, string> => {
  if (!isRecord(value)) {
    return {};
  }
  return Object.entries(value).reduce(
    (acc, [key, entry]) => {
      if (typeof entry === "string") {
        acc[key] = entry;
      }
      return acc;
    },
    {} as Record<string, string>,
  );
};

export class ManagementService extends Context.Tag("@sdk/services/ManagementService")<
  ManagementService,
  {
    readonly describeCloudWatchAlarms: (
      region: string,
    ) => Effect.Effect<CloudWatchAlarm[], unknown>;
    readonly describeCloudFrontDistributions: () => Effect.Effect<
      CloudFrontDistribution[],
      unknown
    >;
    readonly describeRoute53HostedZones: () => Effect.Effect<Route53HostedZone[], unknown>;
    readonly describeCloudFormationStacks: (
      region: string,
    ) => Effect.Effect<CloudFormationStack[], unknown>;
    readonly describeAPIGateways: (region: string) => Effect.Effect<APIGatewayType[], unknown>;
    readonly describeAPIGatewaysV2: (region: string) => Effect.Effect<APIGatewayV2Api[], unknown>;
    readonly describeStepFunctions: (region: string) => Effect.Effect<StepFunction[], unknown>;
    readonly describeEventBridgeRules: (
      region: string,
    ) => Effect.Effect<EventBridgeRule[], unknown>;
    readonly describeCloudTrails: (region: string) => Effect.Effect<CloudTrailType[], unknown>;
    readonly describeSSMParameters: (region: string) => Effect.Effect<SSMParameter[], unknown>;
    readonly describeRoute53Domains: () => Effect.Effect<Route53Domain[], unknown>;
  }
>() {}

export const ManagementServiceLive = Layer.effect(
  ManagementService,
  Effect.succeed(
    ManagementService.of({
      describeCloudWatchAlarms: (region: string) =>
        CloudWatch.describeAlarms.items({}).pipe(
          Stream.map((a): CloudWatchAlarm => {
            const record = asRecord(a);
            return {
              alarmName: getString(record, "AlarmName") ?? "unknown",
              alarmDescription: getString(record, "AlarmDescription") ?? "N/A",
              stateValue: getString(record, "StateValue") ?? "UNKNOWN",
              stateReason: getString(record, "StateReason") ?? "N/A",
              metricName: getString(record, "MetricName") ?? "N/A",
              namespace: getString(record, "Namespace") ?? "N/A",
            };
          }),
          Stream.runCollect,
          Effect.map((c) => Array.from(c)),
          Effect.provide(makeRegionConfig(region)),
          Effect.provide(AwsConfigLive),
        ),

      describeCloudFrontDistributions: () => patchedCloudFront(),

      describeRoute53HostedZones: () => patchedRoute53(),

      describeCloudFormationStacks: (region: string) =>
        CloudFormation.describeStacks.items({}).pipe(
          Stream.map((s): CloudFormationStack => {
            const record = asRecord(s);
            return {
              stackName: getString(record, "StackName") ?? "unknown",
              stackId: getString(record, "StackId") ?? "unknown",
              stackStatus: getString(record, "StackStatus") ?? "UNKNOWN",
              creationTime: getDateISOString(record, "CreationTime"),
              lastUpdatedTime: getDateISOString(record, "LastUpdatedTime"),
              tags: mapTags(getArray(record, "Tags")),
            };
          }),
          Stream.runCollect,
          Effect.map((c) => Array.from(c)),
          Effect.provide(makeRegionConfig(region)),
          Effect.provide(AwsConfigLive),
        ),

      describeAPIGateways: (region: string) =>
        APIGateway.getRestApis.items({}).pipe(
          Stream.map((a): APIGatewayType => {
            const record = asRecord(a);
            const endpointConfig = getRecord(record, "endpointConfiguration");
            const endpointTypes = endpointConfig ? getArray(endpointConfig, "types") : [];
            const firstEndpointType = endpointTypes[0];
            return {
              id: getString(record, "id") ?? "unknown",
              name: getString(record, "name") ?? "unknown",
              protocolType: "REST",
              apiEndpoint: typeof firstEndpointType === "string" ? firstEndpointType : "N/A",
              createdDate: getDateISOString(record, "createdDate"),
              tags: toStringRecord(record.tags),
            };
          }),
          Stream.runCollect,
          Effect.map((c) => Array.from(c)),
          Effect.provide(makeRegionConfig(region)),
          Effect.provide(AwsConfigLive),
        ),

      describeAPIGatewaysV2: (region: string) =>
        APIGatewayV2.getApis({}).pipe(
          Effect.map((r) => {
            const record = asRecord(r);
            const items = [...getArray(record, "Items"), ...getArray(record, "items")];
            return items.map((a): APIGatewayV2Api => {
              const api = asRecord(a);
              return {
                id: getString(api, "ApiId") ?? "unknown",
                name: getString(api, "Name") ?? "unknown",
                protocolType: getString(api, "ProtocolType"),
                apiEndpoint: getString(api, "ApiEndpoint"),
              };
            });
          }),
          Effect.provide(makeRegionConfig(region)),
          Effect.provide(AwsConfigLive),
        ),

      describeStepFunctions: (region: string) =>
        SFN.listStateMachines.items({}).pipe(
          Stream.map((s): StepFunction => {
            const record = asRecord(s);
            return {
              stateMachineArn: getString(record, "stateMachineArn") ?? "unknown",
              name: getString(record, "name") ?? "unknown",
              type: getString(record, "type") ?? "STANDARD",
              status: "ACTIVE",
              creationDate: getDateISOString(record, "creationDate"),
            };
          }),
          Stream.runCollect,
          Effect.map((c) => Array.from(c)),
          Effect.provide(makeRegionConfig(region)),
          Effect.provide(AwsConfigLive),
        ),

      describeEventBridgeRules: (region: string) =>
        Effect.gen(function* (_) {
          const config = makeRegionConfig(region);
          const resp = yield* _(
            EventBridge.listRules({}).pipe(Effect.provide(config), Effect.provide(AwsConfigLive)),
          );
          const rules = getArray(asRecord(resp), "Rules");
          return rules.map((r): EventBridgeRule => {
            const rule = asRecord(r);
            return {
              name: getString(rule, "Name") ?? "unknown",
              arn: getString(rule, "Arn") ?? "unknown",
              state: getString(rule, "State") ?? "UNKNOWN",
              description: getString(rule, "Description"),
              eventPattern: getString(rule, "EventPattern"),
            };
          });
        }),

      describeCloudTrails: (region: string) =>
        Effect.gen(function* (_) {
          const config = makeRegionConfig(region);
          const trailNames = yield* _(
            CloudTrail.listTrails.items({}).pipe(
              Stream.runCollect,
              Effect.map((c) =>
                Array.from(c)
                  .map((t) => getString(asRecord(t), "Name"))
                  .filter((name): name is string => typeof name === "string"),
              ),
              Effect.provide(config),
              Effect.provide(AwsConfigLive),
            ),
          );

          if (trailNames.length === 0) {
            return [];
          }

          const resp = yield* _(
            CloudTrail.describeTrails({ trailNameList: trailNames }).pipe(
              Effect.provide(config),
              Effect.provide(AwsConfigLive),
            ),
          );

          return getArray(asRecord(resp), "trailList").map((t): CloudTrailType => {
            const trail = asRecord(t);
            return {
              name: getString(trail, "Name") ?? "unknown",
              trailARN: getString(trail, "TrailARN") ?? "unknown",
              homeRegion: getString(trail, "HomeRegion"),
              isMultiRegionTrail: getBoolean(trail, "IsMultiRegionTrail"),
              isOrganizationTrail: getBoolean(trail, "IsOrganizationTrail"),
              s3BucketName: getString(trail, "S3BucketName"),
              logFileValidationEnabled: getBoolean(trail, "LogFileValidationEnabled"),
            };
          });
        }),

      describeSSMParameters: (region: string) =>
        SSM.describeParameters.items({}).pipe(
          Stream.map((p): SSMParameter => {
            const record = asRecord(p);
            return {
              name: getString(record, "Name") ?? "unknown",
              type: getString(record, "Type") ?? "UNKNOWN",
              version: getNumber(record, "Version"),
              lastModifiedDate: getDateISOString(record, "LastModifiedDate"),
              arn: getString(record, "ARN"),
            };
          }),
          Stream.runCollect,
          Effect.map((c) => Array.from(c)),
          Effect.provide(makeRegionConfig(region)),
          Effect.provide(AwsConfigLive),
        ),

      describeRoute53Domains: () =>
        Route53Domains.listDomains.items({}).pipe(
          Stream.map((d): Route53Domain => {
            const record = asRecord(d);
            return {
              domainName: getString(record, "DomainName") ?? "unknown",
              autoRenew: getBoolean(record, "AutoRenew"),
              transferLock: getBoolean(record, "TransferLock"),
            };
          }),
          Stream.runCollect,
          Effect.map((c) => Array.from(c)),
          Effect.provide(AwsConfigLive),
        ),
    }),
  ),
);
