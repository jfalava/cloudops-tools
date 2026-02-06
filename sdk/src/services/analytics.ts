import * as Athena from "distilled-aws/athena";
import * as EMR from "distilled-aws/emr";
import * as Kinesis from "distilled-aws/kinesis";
import { Context, Effect, Stream, Layer } from "effect";

import type { KinesisStream, AthenaWorkgroup, EMRCluster } from "../types/aws-cli.types";

import { makeRegionConfig, AwsConfigLive } from "../lib/aws-config";
import {
  asDate,
  asNumber,
  asString,
  isObjectRecord,
  normalizeArray,
  tagListToRecord,
} from "../lib/aws-payload";

function toIsoString(value: unknown): string | undefined {
  return asDate(value)?.toISOString();
}

export class AnalyticsService extends Context.Tag("@sdk/services/AnalyticsService")<
  AnalyticsService,
  {
    readonly describeKinesisStreams: (region: string) => Effect.Effect<KinesisStream[], unknown>;
    readonly describeAthenaWorkgroups: (
      region: string,
    ) => Effect.Effect<AthenaWorkgroup[], unknown>;
    readonly describeEMRClusters: (region: string) => Effect.Effect<EMRCluster[], unknown>;
  }
>() {}

export const AnalyticsServiceLive = Layer.effect(
  AnalyticsService,
  Effect.succeed(
    AnalyticsService.of({
      describeKinesisStreams: (region: string) =>
        Effect.gen(function* (_) {
          const config = makeRegionConfig(region);
          const resp: unknown = yield* _(
            Kinesis.listStreams({}).pipe(Effect.provide(config), Effect.provide(AwsConfigLive)),
          );
          const streamNames = isObjectRecord(resp)
            ? normalizeArray(resp.StreamNames)
                .map((name) => asString(name))
                .filter((name): name is string => Boolean(name))
            : [];

          return yield* _(
            Effect.forEach(
              streamNames,
              (name) =>
                Effect.gen(function* (_) {
                  const descData: unknown = yield* _(
                    Kinesis.describeStream({ StreamName: name }).pipe(
                      Effect.provide(config),
                      Effect.provide(AwsConfigLive),
                    ),
                  );
                  const sd =
                    isObjectRecord(descData) && isObjectRecord(descData.StreamDescription)
                      ? descData.StreamDescription
                      : undefined;
                  if (!sd) {
                    return null;
                  }

                  const tagsResp: unknown = yield* _(
                    Kinesis.listTagsForStream({ StreamName: name }).pipe(
                      Effect.catchAll(() => Effect.succeed({ Tags: [] })),
                      Effect.provide(config),
                      Effect.provide(AwsConfigLive),
                    ),
                  );
                  const tags = isObjectRecord(tagsResp) ? tagListToRecord(tagsResp.Tags) : {};

                  return {
                    streamName: asString(sd.StreamName) ?? "unknown",
                    streamARN: asString(sd.StreamARN) ?? "unknown",
                    streamStatus: asString(sd.StreamStatus) ?? "UNKNOWN",
                    retentionPeriodHours: asNumber(sd.RetentionPeriodHours),
                    streamCreationTimestamp: toIsoString(sd.StreamCreationTimestamp),
                    shardCount: Array.isArray(sd.Shards) ? sd.Shards.length : undefined,
                    tags,
                  } as KinesisStream;
                }),
              { concurrency: 5 },
            ),
            Effect.map((results) => results.filter((s): s is KinesisStream => s !== null)),
          );
        }),

      describeAthenaWorkgroups: (region: string) =>
        Athena.listWorkGroups
          .items({})
          .pipe(
            Stream.map((w: unknown) => (isObjectRecord(w) ? asString(w.Name) : undefined)),
            Stream.runCollect,
            Effect.map((c) => Array.from(c).filter((n): n is string => Boolean(n))),
            Effect.provide(makeRegionConfig(region)),
            Effect.provide(AwsConfigLive),
          )
          .pipe(
            Effect.flatMap((names) =>
              Effect.forEach(
                names,
                (name) =>
                  Athena.getWorkGroup({ WorkGroup: name }).pipe(
                    Effect.map((r) => r.WorkGroup),
                    Effect.map((w): AthenaWorkgroup | null =>
                      isObjectRecord(w)
                        ? {
                            name: asString(w.Name) ?? "unknown",
                            state: asString(w.State) ?? "UNKNOWN",
                            description: asString(w.Description),
                            creationTime: toIsoString(w.CreationTime),
                            tags: {},
                          }
                        : null,
                    ),
                    Effect.catchAll(() => Effect.succeed(null)),
                    Effect.provide(makeRegionConfig(region)),
                    Effect.provide(AwsConfigLive),
                  ),
                { concurrency: 5 },
              ),
            ),
            Effect.map((results) => results.filter((w): w is AthenaWorkgroup => w !== null)),
          ),

      describeEMRClusters: (region: string) =>
        EMR.listClusters
          .items({
            ClusterStates: ["STARTING", "BOOTSTRAPPING", "RUNNING", "WAITING", "TERMINATING"],
          })
          .pipe(
            Stream.runCollect,
            Effect.map((c) =>
              Array.from(c)
                .map((cluster) => (isObjectRecord(cluster) ? asString(cluster.Id) : undefined))
                .filter((id): id is string => Boolean(id)),
            ),
            Effect.provide(makeRegionConfig(region)),
            Effect.provide(AwsConfigLive),
          )
          .pipe(
            Effect.flatMap((ids) =>
              Effect.forEach(
                ids,
                (id) =>
                  EMR.describeCluster({ ClusterId: id }).pipe(
                    Effect.map((r) => r.Cluster),
                    Effect.map((c: unknown): EMRCluster | null => {
                      if (!isObjectRecord(c)) {
                        return null;
                      }
                      const tags = tagListToRecord(c.Tags);
                      const status = isObjectRecord(c.Status) ? c.Status : undefined;
                      const timeline = isObjectRecord(status?.Timeline)
                        ? status.Timeline
                        : undefined;

                      return {
                        id: asString(c.Id) ?? "unknown",
                        name: asString(c.Name) ?? "unknown",
                        status: asString(status?.State) ?? "UNKNOWN",
                        creationDateTime: toIsoString(timeline?.CreationDateTime),
                        releaseLabel: asString(c.ReleaseLabel),
                        instanceCount: 0,
                        tags,
                      };
                    }),
                    Effect.catchAll(() => Effect.succeed(null)),
                    Effect.provide(makeRegionConfig(region)),
                    Effect.provide(AwsConfigLive),
                  ),
                { concurrency: 5 },
              ),
            ),
            Effect.map((results) => results.filter((c): c is EMRCluster => c !== null)),
          ),
    }),
  ),
);
