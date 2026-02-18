import * as ConfigService from "distilled-aws/config-service";
import * as ControlTower from "distilled-aws/controltower";
import * as Organizations from "distilled-aws/organizations";
import { Context, Effect, Stream, Layer } from "effect";

import { makeRegionConfig, AwsConfigLive } from "../lib/aws-config";
import { asBoolean, asString, isObjectRecord, normalizeArray } from "../lib/aws-payload";
import type {
  ControlTowerGuardrail,
  ServiceControlPolicy,
  ConfigRule,
} from "../types/aws-cli.types";

function getControlName(controlIdentifier: unknown): string {
  const identifier = asString(controlIdentifier);
  if (!identifier) {
    return "Unknown";
  }

  const segments = identifier.split("/");
  return segments.length > 0 ? (segments[segments.length - 1] ?? "Unknown") : "Unknown";
}

export class GovernanceService extends Context.Tag("@sdk/services/GovernanceService")<
  GovernanceService,
  {
    readonly describeControlTowerGuardrails: (
      region: string,
    ) => Effect.Effect<ControlTowerGuardrail[], unknown>;
    readonly describeServiceControlPolicies: () => Effect.Effect<ServiceControlPolicy[], unknown>;
    readonly describeConfigRules: (region: string) => Effect.Effect<ConfigRule[], unknown>;
  }
>() {}

export const GovernanceServiceLive = Layer.effect(
  GovernanceService,
  Effect.succeed(
    GovernanceService.of({
      describeControlTowerGuardrails: (region: string) =>
        Effect.gen(function* (_) {
          const config = makeRegionConfig(region);

          const lzData = yield* _(
            ControlTower.listLandingZones({}).pipe(
              Effect.catchAll(() => Effect.succeed({ landingZones: [] })),
              Effect.provide(config),
              Effect.provide(AwsConfigLive),
            ),
          );

          if (
            !isObjectRecord(lzData) ||
            !Array.isArray(lzData.landingZones) ||
            lzData.landingZones.length === 0
          ) {
            return [];
          }

          return yield* _(
            ControlTower.listEnabledControls.items({}).pipe(
              Stream.map((c: unknown): ControlTowerGuardrail => {
                if (!isObjectRecord(c)) {
                  return {
                    guardrailArn: "",
                    guardrailName: "Unknown",
                    guardrailState: "UNKNOWN",
                    behavior: "PREVENTIVE",
                    organizationalUnitArn: "",
                  };
                }

                const controlIdentifier = asString(c.controlIdentifier) ?? "";
                const statusSummary = isObjectRecord(c.statusSummary) ? c.statusSummary : undefined;

                return {
                  guardrailArn: asString(c.arn) ?? "",
                  guardrailName: getControlName(c.controlIdentifier),
                  guardrailState: asString(statusSummary?.status) ?? "UNKNOWN",
                  behavior: controlIdentifier.includes("detective") ? "DETECTIVE" : "PREVENTIVE",
                  organizationalUnitArn: asString(c.targetIdentifier) ?? "",
                };
              }),
              Stream.runCollect,
              Effect.map((c) => Array.from(c)),
              Effect.provide(config),
              Effect.provide(AwsConfigLive),
            ),
          );
        }),

      describeServiceControlPolicies: () =>
        Organizations.listPolicies.items({ Filter: "SERVICE_CONTROL_POLICY" }).pipe(
          Stream.map((p: unknown): ServiceControlPolicy => {
            if (!isObjectRecord(p)) {
              return {
                id: "unknown",
                arn: "unknown",
                name: "unknown",
                description: "",
                type: "UNKNOWN",
                awsManaged: false,
              };
            }

            return {
              id: asString(p.Id) ?? "unknown",
              arn: asString(p.Arn) ?? "unknown",
              name: asString(p.Name) ?? "unknown",
              description: asString(p.Description) ?? "",
              type: asString(p.Type) ?? "UNKNOWN",
              awsManaged: asBoolean(p.AwsManaged) ?? false,
            };
          }),
          Stream.runCollect,
          Effect.map((c) => Array.from(c)),
          Effect.provide(AwsConfigLive),
        ),

      describeConfigRules: (region: string) =>
        Effect.gen(function* (_) {
          const config = makeRegionConfig(region);

          const rulesData: unknown = yield* _(
            ConfigService.describeConfigRules({}).pipe(
              Effect.provide(config),
              Effect.provide(AwsConfigLive),
            ),
          );

          const complianceData: unknown = yield* _(
            ConfigService.describeComplianceByConfigRule({}).pipe(
              Effect.provide(config),
              Effect.provide(AwsConfigLive),
            ),
          );

          const complianceMap: Record<string, string> = {};
          if (isObjectRecord(complianceData)) {
            for (const complianceRule of normalizeArray(complianceData.ComplianceByConfigRules)) {
              if (!isObjectRecord(complianceRule)) {
                continue;
              }

              const ruleName = asString(complianceRule.ConfigRuleName);
              const compliance = isObjectRecord(complianceRule.Compliance)
                ? asString(complianceRule.Compliance.ComplianceType)
                : undefined;

              if (ruleName && compliance) {
                complianceMap[ruleName] = compliance;
              }
            }
          }

          if (!isObjectRecord(rulesData)) {
            return [];
          }

          return normalizeArray(rulesData.ConfigRules).map((r): ConfigRule => {
            if (!isObjectRecord(r)) {
              return {
                configRuleName: "unknown",
                configRuleArn: "",
                configRuleId: "",
                description: "",
                complianceStatus: "NOT_EVALUATED",
                source: "Custom",
              };
            }

            const configRuleName = asString(r.ConfigRuleName) ?? "unknown";
            const source =
              isObjectRecord(r.Source) && asString(r.Source.Owner) === "AWS"
                ? "AWS Managed"
                : "Custom";

            return {
              configRuleName,
              configRuleArn: asString(r.ConfigRuleArn) ?? "",
              configRuleId: asString(r.ConfigRuleId) ?? "",
              description: asString(r.Description) ?? "",
              complianceStatus: complianceMap[configRuleName] ?? "NOT_EVALUATED",
              source,
            };
          });
        }),
    }),
  ),
);
