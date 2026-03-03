import type { ECRRepository, GlueJob } from "@cloudops-tools/types/aws";
import * as ECR from "distilled-aws/ecr";
import * as Glue from "distilled-aws/glue";
import { Context, Effect, Stream, Layer } from "effect";

import { makeRegionConfig, AwsConfigLive } from "../lib/aws-config";
import { asDate, asString, isObjectRecord } from "../lib/aws-payload";

export class DeveloperToolsService extends Context.Tag("@sdk/services/DeveloperToolsService")<
  DeveloperToolsService,
  {
    readonly describeECRRepositories: (region: string) => Effect.Effect<ECRRepository[], unknown>;
    readonly describeGlueJobs: (region: string) => Effect.Effect<GlueJob[], unknown>;
  }
>() {}

export const DeveloperToolsServiceLive = Layer.effect(
  DeveloperToolsService,
  Effect.succeed(
    DeveloperToolsService.of({
      describeECRRepositories: (region: string) =>
        ECR.describeRepositories.items({}).pipe(
          Stream.map((repo: unknown): ECRRepository => {
            if (!isObjectRecord(repo)) {
              return {
                repositoryName: "unknown",
                repositoryArn: "unknown",
                registryId: "unknown",
                createdAt: "N/A",
              };
            }

            const createdAt = asDate(repo.createdAt);
            return {
              repositoryName: asString(repo.repositoryName) ?? "unknown",
              repositoryArn: asString(repo.repositoryArn) ?? "unknown",
              registryId: asString(repo.registryId) ?? "unknown",
              createdAt: createdAt?.toISOString() ?? "N/A",
            };
          }),
          Stream.runCollect,
          Effect.map((c) => Array.from(c)),
          Effect.provide(makeRegionConfig(region)),
          Effect.provide(AwsConfigLive),
        ),

      describeGlueJobs: (region: string) =>
        Effect.gen(function* () {
          const config = makeRegionConfig(region);
          const jobNames = yield* Glue.listJobs.items({}).pipe(
            Stream.runCollect,
            Effect.map((c) => Array.from(c)),
            Effect.flatMap((rawJobNames) =>
              Effect.try({
                try: () =>
                  rawJobNames.map((rawName) => {
                    const jobName = asString(rawName);
                    if (!jobName) {
                      throw new Error(
                        `Glue.listJobs returned non-string JobName in region "${region}"`,
                      );
                    }
                    return jobName;
                  }),
                catch: (error) =>
                  error instanceof Error
                    ? error
                    : new Error(`Failed to parse Glue job names: ${String(error)}`),
              }),
            ),
            Effect.provide(config),
            Effect.provide(AwsConfigLive),
          );

          if (jobNames.length === 0) {
            return [];
          }

          return yield* Effect.forEach(
            jobNames,
            (name) =>
              Glue.getJob({ JobName: name }).pipe(
                Effect.map((r) => {
                  const j = r.Job;
                  const job: GlueJob = {
                    name: j?.Name ?? "unknown",
                    description: j?.Description ?? "N/A",
                    role: j?.Role ?? "unknown",
                    createdOn: j?.CreatedOn?.toISOString() || "N/A",
                    lastModifiedOn: j?.LastModifiedOn?.toISOString() || "N/A",
                    executionProperty: j?.ExecutionProperty ?? null,
                  };
                  return job;
                }),
                Effect.tapError((error) =>
                  Effect.sync(() => {
                    const message = error instanceof Error ? error.message : String(error);
                    console.warn(`Failed to describe Glue job "${name}" in ${region}: ${message}`);
                  }),
                ),
                Effect.catchAll(() => Effect.succeed(null)),
                Effect.provide(config),
                Effect.provide(AwsConfigLive),
              ),
            { concurrency: 5 },
          ).pipe(Effect.map((results) => results.filter((j): j is GlueJob => j !== null)));
        }),
    }),
  ),
);
