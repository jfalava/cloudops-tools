import type {
  S3Bucket,
  EBSVolume,
  EFSFileSystem,
  BackupVault,
  FsxFileSystem,
  GlacierVault,
  StorageGateway,
  BackupGateway,
  RbinRule,
} from "@cloudops-tools/types/aws";
import * as Backup from "distilled-aws/backup";
import * as BackupGatewaySvc from "distilled-aws/backup-gateway";
import * as EC2 from "distilled-aws/ec2";
import * as EFS from "distilled-aws/efs";
import * as FSx from "distilled-aws/fsx";
import * as Glacier from "distilled-aws/glacier";
import * as Rbin from "distilled-aws/rbin";
import * as S3 from "distilled-aws/s3";
import * as StorageGatewaySvc from "distilled-aws/storage-gateway";
import { Context, Effect, Stream, Layer } from "effect";

import { makeRegionConfig, AwsConfigLive } from "../lib/aws-config";
import {
  asBoolean,
  asDate,
  asNumber,
  asString,
  getNameTag,
  isObjectRecord,
  tagListToRecord,
} from "../lib/aws-payload";

function toIsoString(value: unknown): string | undefined {
  return asDate(value)?.toISOString();
}

export class StorageService extends Context.Tag("@sdk/services/StorageService")<
  StorageService,
  {
    readonly describeS3: () => Effect.Effect<S3Bucket[], unknown>;
    readonly describeEBS: (region: string) => Effect.Effect<EBSVolume[], unknown>;
    readonly describeEFS: (region: string) => Effect.Effect<EFSFileSystem[], unknown>;
    readonly describeBackup: (region: string) => Effect.Effect<BackupVault[], unknown>;
    readonly describeFSx: (region: string) => Effect.Effect<FsxFileSystem[], unknown>;
    readonly describeGlacierVaults: (region: string) => Effect.Effect<GlacierVault[], unknown>;
    readonly describeStorageGateways: (region: string) => Effect.Effect<StorageGateway[], unknown>;
    readonly describeBackupGateways: (region: string) => Effect.Effect<BackupGateway[], unknown>;
    readonly describeRbinRules: (region: string) => Effect.Effect<RbinRule[], unknown>;
  }
>() {}

export const StorageServiceLive = Layer.succeed(StorageService, {
  describeS3: () =>
    Effect.gen(function* (_) {
      const response = yield* _(S3.listBuckets({}).pipe(Effect.provide(AwsConfigLive)));

      const buckets = response.Buckets || [];

      return yield* _(
        Effect.forEach(
          buckets,
          (bucket) =>
            Effect.gen(function* (__inner) {
              if (!bucket.Name) {
                return null;
              }
              const name = bucket.Name;

              const region = yield* __inner(
                S3.getBucketLocation({ Bucket: name }).pipe(
                  Effect.map((r) => r.LocationConstraint || "us-east-1"),
                  Effect.catchAll(() => Effect.succeed("us-east-1")),
                  Effect.provide(AwsConfigLive),
                ),
              );

              const publicAccess = yield* __inner(
                S3.getPublicAccessBlock({ Bucket: name }).pipe(
                  Effect.map((r) => {
                    const c = r.PublicAccessBlockConfiguration;
                    return !(
                      c?.BlockPublicAcls &&
                      c?.BlockPublicPolicy &&
                      c?.IgnorePublicAcls &&
                      c?.RestrictPublicBuckets
                    );
                  }),
                  Effect.catchAll(() => Effect.succeed(true)),
                  Effect.provide(AwsConfigLive),
                ),
              );

              const tags = yield* __inner(
                S3.getBucketTagging({ Bucket: name }).pipe(
                  Effect.map((r) =>
                    (r.TagSet || []).reduce(
                      (acc, t) => {
                        if (t.Key) {
                          acc[t.Key] = t.Value || "";
                        }
                        return acc;
                      },
                      {} as Record<string, string>,
                    ),
                  ),
                  Effect.catchAll(() => Effect.succeed({})),
                  Effect.provide(AwsConfigLive),
                ),
              );

              return {
                name,
                creationDate: bucket.CreationDate?.toISOString() || "N/A",
                region,
                publicAccess,
                tags,
              } as S3Bucket;
            }),
          { concurrency: 10 },
        ),
        Effect.map((results) => results.filter((b): b is S3Bucket => b !== null)),
      );
    }),

  describeEBS: (region: string) =>
    EC2.describeVolumes.items({}).pipe(
      Stream.map((vol: unknown): EBSVolume => {
        if (!isObjectRecord(vol)) {
          return {
            volumeId: "unknown",
            name: "N/A",
            size: 0,
            volumeType: "unknown",
            state: "unknown",
            encrypted: false,
            availabilityZone: "unknown",
          };
        }

        const tags = Array.isArray(vol.Tags) ? tagListToRecord(vol.Tags) : undefined;

        return {
          volumeId: asString(vol.VolumeId) ?? "unknown",
          name: getNameTag(vol.Tags) ?? "N/A",
          size: asNumber(vol.Size) ?? 0,
          volumeType: asString(vol.VolumeType) ?? "unknown",
          state: asString(vol.State) ?? "unknown",
          encrypted: asBoolean(vol.Encrypted) ?? false,
          availabilityZone: asString(vol.AvailabilityZone) ?? "unknown",
          createTime: toIsoString(vol.CreateTime),
          attachments: Array.isArray(vol.Attachments) ? vol.Attachments : undefined,
          tags,
        };
      }),
      Stream.runCollect,
      Effect.map((chunk) => Array.from(chunk)),
      Effect.provide(makeRegionConfig(region)),
      Effect.provide(AwsConfigLive),
    ),

  describeEFS: (region: string) =>
    EFS.describeFileSystems.items({}).pipe(
      Stream.map((fs: unknown): EFSFileSystem => {
        if (!isObjectRecord(fs)) {
          return {
            fileSystemId: "unknown",
            name: "unknown",
            lifeCycleState: "unknown",
            encrypted: false,
            performanceMode: "unknown",
          };
        }

        const fileSystemId = asString(fs.FileSystemId) ?? "unknown";
        const sizeInBytes = isObjectRecord(fs.SizeInBytes)
          ? asNumber(fs.SizeInBytes.Value)
          : undefined;
        const tags = Array.isArray(fs.Tags) ? tagListToRecord(fs.Tags) : undefined;

        return {
          fileSystemId,
          name: asString(fs.Name) ?? fileSystemId,
          lifeCycleState: asString(fs.LifeCycleState) ?? "unknown",
          sizeInBytes,
          creationTime: toIsoString(fs.CreationTime),
          encrypted: asBoolean(fs.Encrypted) ?? false,
          performanceMode: asString(fs.PerformanceMode) ?? "unknown",
          tags,
        };
      }),
      Stream.runCollect,
      Effect.map((chunk) => Array.from(chunk)),
      Effect.provide(makeRegionConfig(region)),
      Effect.provide(AwsConfigLive),
    ),

  describeBackup: (region: string) =>
    Backup.listBackupVaults.items({}).pipe(
      Stream.map((vault: unknown): BackupVault => {
        if (!isObjectRecord(vault)) {
          return {
            backupVaultName: "unknown",
            backupVaultArn: "unknown",
            numberOfRecoveryPoints: 0,
            locked: false,
            tags: {},
          };
        }

        return {
          backupVaultName: asString(vault.BackupVaultName) ?? "unknown",
          backupVaultArn: asString(vault.BackupVaultArn) ?? "unknown",
          creationDate: toIsoString(vault.CreationDate),
          encryptionKeyArn: asString(vault.EncryptionKeyArn),
          numberOfRecoveryPoints: asNumber(vault.NumberOfRecoveryPoints) ?? 0,
          locked: asBoolean(vault.Locked) ?? false,
          tags: {},
        };
      }),
      Stream.runCollect,
      Effect.map((chunk) => Array.from(chunk)),
      Effect.provide(makeRegionConfig(region)),
      Effect.provide(AwsConfigLive),
    ),

  describeFSx: (region: string) =>
    FSx.describeFileSystems.items({}).pipe(
      Stream.map((fs: unknown): FsxFileSystem => {
        if (!isObjectRecord(fs)) {
          return { id: "unknown" };
        }

        return {
          id: asString(fs.FileSystemId) ?? "unknown",
          arn: asString(fs.ResourceARN),
          type: asString(fs.FileSystemType),
          storageCapacity: asNumber(fs.StorageCapacity),
        };
      }),
      Stream.runCollect,
      Effect.map((chunk) => Array.from(chunk)),
      Effect.provide(makeRegionConfig(region)),
      Effect.provide(AwsConfigLive),
    ),

  describeGlacierVaults: (region: string) =>
    Glacier.listVaults.items({ accountId: "-" }).pipe(
      Stream.map((v: unknown): GlacierVault => {
        if (!isObjectRecord(v)) {
          return { name: "unknown" };
        }

        return {
          name: asString(v.VaultName) ?? "unknown",
          arn: asString(v.VaultARN),
          creationDate: asString(v.CreationDate) ?? toIsoString(v.CreationDate),
          numberOfArchives: asNumber(v.NumberOfArchives),
        };
      }),
      Stream.runCollect,
      Effect.map((chunk) => Array.from(chunk)),
      Effect.provide(makeRegionConfig(region)),
      Effect.provide(AwsConfigLive),
    ),

  describeStorageGateways: (region: string) =>
    StorageGatewaySvc.listGateways.items({}).pipe(
      Stream.map((g: unknown): StorageGateway => {
        if (!isObjectRecord(g)) {
          return { id: "unknown" };
        }

        return {
          id: asString(g.GatewayId) ?? "unknown",
          arn: asString(g.GatewayARN),
          type: asString(g.GatewayType),
          state: asString(g.GatewayState),
        };
      }),
      Stream.runCollect,
      Effect.map((chunk) => Array.from(chunk)),
      Effect.provide(makeRegionConfig(region)),
      Effect.provide(AwsConfigLive),
    ),

  describeBackupGateways: (region: string) =>
    BackupGatewaySvc.listGateways.items({}).pipe(
      Stream.map((g: unknown): BackupGateway => {
        if (!isObjectRecord(g)) {
          return { name: "unknown" };
        }

        return {
          name: asString(g.GatewayName) ?? "unknown",
          arn: asString(g.GatewayArn),
          state: asString(g.GatewayState),
        };
      }),
      Stream.runCollect,
      Effect.map((chunk) => Array.from(chunk)),
      Effect.provide(makeRegionConfig(region)),
      Effect.provide(AwsConfigLive),
    ),

  describeRbinRules: (region: string) =>
    Rbin.listRules.items({ ResourceType: "EBS_SNAPSHOT" }).pipe(
      Stream.map((r: unknown): RbinRule => {
        if (!isObjectRecord(r)) {
          return { id: "unknown" };
        }

        return {
          id: asString(r.Identifier) ?? "unknown",
          arn: asString(r.RuleArn),
          resourceType: asString(r.ResourceType),
          status: asString(r.Status),
        };
      }),
      Stream.runCollect,
      Effect.map((chunk) => Array.from(chunk)),
      Effect.provide(makeRegionConfig(region)),
      Effect.provide(AwsConfigLive),
    ),
});
