import * as Cognito from "distilled-aws/cognito-identity-provider";
import * as GuardDuty from "distilled-aws/guardduty";
import * as IAM from "distilled-aws/iam";
import * as KMS from "distilled-aws/kms";
import * as SecretsManager from "distilled-aws/secrets-manager";
import * as WAFV2 from "distilled-aws/wafv2";
import { Context, Effect, Stream, Layer } from "effect";

import type {
  IAMUser,
  IAMRole,
  KMSKey,
  SecretsManagerSecret,
  WAFWebACL,
  GuardDutyDetector,
  CognitoUserPool,
} from "../types/aws-cli.types";

import { makeRegionConfig, AwsConfigLive } from "../lib/aws-config";
import {
  asDate,
  asString,
  isObjectRecord,
  normalizeArray,
  tagListToRecord,
} from "../lib/aws-payload";

type WafAclBase = Omit<WAFWebACL, "tags">;

function toIsoString(value: unknown): string | undefined {
  return asDate(value)?.toISOString();
}

export class SecurityService extends Context.Tag("@sdk/services/SecurityService")<
  SecurityService,
  {
    readonly describeIAMUsers: () => Effect.Effect<IAMUser[], unknown>;
    readonly describeIAMRoles: () => Effect.Effect<IAMRole[], unknown>;
    readonly describeKMSKeys: (region: string) => Effect.Effect<KMSKey[], unknown>;
    readonly describeSecretsManagerSecrets: (
      region: string,
    ) => Effect.Effect<SecretsManagerSecret[], unknown>;
    readonly describeWAFWebACLs: (region: string) => Effect.Effect<WAFWebACL[], unknown>;
    readonly describeGuardDutyDetectors: (
      region: string,
    ) => Effect.Effect<GuardDutyDetector[], unknown>;
    readonly describeCognitoUserPools: (
      region: string,
    ) => Effect.Effect<CognitoUserPool[], unknown>;
  }
>() {}

export const SecurityServiceLive = Layer.effect(
  SecurityService,
  Effect.succeed(
    SecurityService.of({
      describeIAMUsers: () =>
        IAM.listUsers.items({}).pipe(
          Stream.map((u: unknown): IAMUser => {
            if (!isObjectRecord(u)) {
              return {
                userName: "unknown",
                userId: "unknown",
                arn: "unknown",
                createDate: "N/A",
              };
            }

            return {
              userName: asString(u.UserName) ?? "unknown",
              userId: asString(u.UserId) ?? "unknown",
              arn: asString(u.Arn) ?? "unknown",
              createDate: toIsoString(u.CreateDate) ?? "N/A",
            };
          }),
          Stream.runCollect,
          Effect.map((c) => Array.from(c)),
          Effect.provide(AwsConfigLive),
        ),

      describeIAMRoles: () =>
        IAM.listRoles.items({}).pipe(
          Stream.map((r: unknown): IAMRole => {
            if (!isObjectRecord(r)) {
              return {
                roleName: "unknown",
                roleId: "unknown",
                arn: "unknown",
                createDate: "N/A",
              };
            }

            return {
              roleName: asString(r.RoleName) ?? "unknown",
              roleId: asString(r.RoleId) ?? "unknown",
              arn: asString(r.Arn) ?? "unknown",
              createDate: toIsoString(r.CreateDate) ?? "N/A",
            };
          }),
          Stream.runCollect,
          Effect.map((c) => Array.from(c)),
          Effect.provide(AwsConfigLive),
        ),

      describeKMSKeys: (region: string) =>
        Effect.gen(function* (_) {
          const config = makeRegionConfig(region);
          const keyIds = yield* _(
            KMS.listKeys.items({}).pipe(
              Stream.map((k: unknown) => {
                if (!isObjectRecord(k)) {
                  return undefined;
                }
                return asString(k.KeyId);
              }),
              Stream.runCollect,
              Effect.map((c) => Array.from(c).filter((id): id is string => Boolean(id))),
              Effect.provide(config),
              Effect.provide(AwsConfigLive),
            ),
          );

          return yield* _(
            Effect.forEach(
              keyIds,
              (id) =>
                KMS.describeKey({ KeyId: id }).pipe(
                  Effect.map((r) => {
                    const k = r.KeyMetadata;
                    return {
                      keyId: k?.KeyId || "unknown",
                      keyArn: k?.Arn || "unknown",
                      description: k?.Description || "N/A",
                      keyUsage: k?.KeyUsage || "N/A",
                      keyState: k?.KeyState || "N/A",
                      creationDate: k?.CreationDate?.toISOString() || "N/A",
                    } as KMSKey;
                  }),
                  Effect.catchAll(() => Effect.succeed(null)),
                  Effect.provide(config),
                  Effect.provide(AwsConfigLive),
                ),
              { concurrency: 5 },
            ),
            Effect.map((results) => results.filter((k): k is KMSKey => k !== null)),
          );
        }),

      describeSecretsManagerSecrets: (region: string) =>
        SecretsManager.listSecrets.items({}).pipe(
          Stream.map((s: unknown): SecretsManagerSecret => {
            if (!isObjectRecord(s)) {
              return {
                name: "unknown",
                description: "N/A",
                secretArn: "unknown",
                createdDate: "N/A",
                lastChangedDate: "N/A",
              };
            }

            return {
              name: asString(s.Name) ?? "unknown",
              description: asString(s.Description) ?? "N/A",
              secretArn: asString(s.ARN) ?? "unknown",
              createdDate: toIsoString(s.CreatedDate) ?? "N/A",
              lastChangedDate: toIsoString(s.LastChangedDate) ?? "N/A",
            };
          }),
          Stream.runCollect,
          Effect.map((c) => Array.from(c)),
          Effect.provide(makeRegionConfig(region)),
          Effect.provide(AwsConfigLive),
        ),

      describeWAFWebACLs: (region: string) =>
        Effect.gen(function* (_) {
          const config = makeRegionConfig(region);
          const resp: unknown = yield* _(
            WAFV2.listWebACLs({ Scope: "REGIONAL" }).pipe(
              Effect.provide(config),
              Effect.provide(AwsConfigLive),
            ),
          );
          const acls: WafAclBase[] = isObjectRecord(resp)
            ? normalizeArray(resp.WebACLs).map((a): WafAclBase => {
                if (!isObjectRecord(a)) {
                  return {
                    name: "unknown",
                    arn: "unknown",
                    id: "unknown",
                    scope: "REGIONAL",
                  };
                }

                return {
                  name: asString(a.Name) ?? "unknown",
                  arn: asString(a.ARN) ?? "unknown",
                  id: asString(a.Id) ?? "unknown",
                  scope: "REGIONAL",
                };
              })
            : [];

          return yield* _(
            Effect.forEach(
              acls,
              (acl) =>
                Effect.gen(function* (_) {
                  const tagsResp: unknown = yield* _(
                    WAFV2.listTagsForResource({ ResourceARN: acl.arn }).pipe(
                      Effect.catchAll(() =>
                        Effect.succeed({ TagInfoForResource: { TagList: [] } }),
                      ),
                      Effect.provide(config),
                      Effect.provide(AwsConfigLive),
                    ),
                  );
                  const tags =
                    isObjectRecord(tagsResp) && isObjectRecord(tagsResp.TagInfoForResource)
                      ? tagListToRecord(tagsResp.TagInfoForResource.TagList)
                      : {};
                  return { ...acl, tags } as WAFWebACL;
                }),
              { concurrency: 5 },
            ),
          );
        }),

      describeGuardDutyDetectors: (region: string) =>
        Effect.gen(function* (_) {
          const config = makeRegionConfig(region);
          const ids = yield* _(
            GuardDuty.listDetectors.items({}).pipe(
              Stream.runCollect,
              Effect.map((c) => Array.from(c)),
              Effect.provide(config),
              Effect.provide(AwsConfigLive),
            ),
          );

          return yield* _(
            Effect.forEach(
              ids,
              (id: unknown) => {
                const detectorId = asString(id) ?? "";
                if (!detectorId) {
                  return Effect.succeed(null);
                }

                return GuardDuty.getDetector({ DetectorId: detectorId }).pipe(
                  Effect.map((r: unknown) => {
                    if (!isObjectRecord(r)) {
                      return null;
                    }

                    const tags: Record<string, string> = {};
                    if (isObjectRecord(r.Tags)) {
                      for (const [k, v] of Object.entries(r.Tags)) {
                        tags[k] = String(v);
                      }
                    }
                    return {
                      detectorId,
                      status: asString(r.Status) ?? "UNKNOWN",
                      serviceRole: asString(r.ServiceRole) ?? "N/A",
                      createdAt: asString(r.CreatedAt) ?? "N/A",
                      tags,
                    } as GuardDutyDetector;
                  }),
                  Effect.catchAll(() => Effect.succeed(null)),
                  Effect.provide(config),
                  Effect.provide(AwsConfigLive),
                );
              },
              { concurrency: 5 },
            ),
            Effect.map((results) => results.filter((d): d is GuardDutyDetector => d !== null)),
          );
        }),

      describeCognitoUserPools: (region: string) =>
        Effect.gen(function* (_) {
          const config = makeRegionConfig(region);
          const pools = yield* _(
            Cognito.listUserPools.items({ MaxResults: 60 }).pipe(
              Stream.runCollect,
              Effect.map((c) => Array.from(c)),
              Effect.provide(config),
              Effect.provide(AwsConfigLive),
            ),
          );

          return yield* _(
            Effect.forEach(
              pools,
              (pool: unknown) =>
                Effect.gen(function* (_) {
                  if (!isObjectRecord(pool)) {
                    return null;
                  }

                  const id = asString(pool.Id);
                  if (!id) {
                    return null;
                  }

                  const detailsResp: unknown = yield* _(
                    Cognito.describeUserPool({ UserPoolId: id }).pipe(
                      Effect.map((r) => r.UserPool),
                      Effect.catchAll(() => Effect.succeed(undefined)),
                      Effect.provide(config),
                      Effect.provide(AwsConfigLive),
                    ),
                  );
                  if (!isObjectRecord(detailsResp) || !asString(detailsResp.Arn)) {
                    return null;
                  }

                  const tagsResp: unknown = yield* _(
                    Cognito.listTagsForResource({
                      ResourceArn: asString(detailsResp.Arn) ?? "",
                    }).pipe(
                      Effect.catchAll(() => Effect.succeed({ Tags: {} })),
                      Effect.provide(config),
                      Effect.provide(AwsConfigLive),
                    ),
                  );

                  const tags: Record<string, string> = {};
                  if (isObjectRecord(tagsResp) && isObjectRecord(tagsResp.Tags)) {
                    for (const [k, v] of Object.entries(tagsResp.Tags)) {
                      tags[k] = String(v);
                    }
                  }

                  return {
                    id,
                    name: asString(detailsResp.Name) ?? asString(pool.Name) ?? "unknown",
                    status: asString(detailsResp.Status),
                    creationDate: toIsoString(detailsResp.CreationDate),
                    lastModifiedDate: toIsoString(detailsResp.LastModifiedDate),
                    mfaConfiguration: asString(detailsResp.MfaConfiguration),
                    tags,
                  } as CognitoUserPool;
                }),
              { concurrency: 5 },
            ),
            Effect.map((results) => results.filter((p): p is CognitoUserPool => p !== null)),
          );
        }),
    }),
  ),
);
