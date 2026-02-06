import * as ECR from "distilled-aws/ecr";
import * as Glue from "distilled-aws/glue";
import { Context, Effect, Stream, Layer } from "effect";

import type { ECRRepository, GlueJob } from "../types/aws-cli.types";

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
        Effect.gen(function* (_) {
          const config = makeRegionConfig(region);
          const jobNames = yield* _(
            Glue.listJobs.items({}).pipe(
              Stream.runCollect,
              Effect.map((c) => Array.from(c)),
              Effect.provide(config),
              Effect.provide(AwsConfigLive),
            ),
          );

          if (jobNames.length === 0) {
            return [];
          }

          return yield* _(
            Effect.forEach(
              jobNames,
              (name) =>
                Glue.getJob({ JobName: name as string }).pipe(
                  Effect.map((r) => {
                    const j = r.Job;
                    return {
                      name: j?.Name || "unknown",
                      description: j?.Description || "N/A",
                      role: j?.Role || "unknown",
                      createdOn: j?.CreatedOn?.toISOString() || "N/A",
                      lastModifiedOn: j?.LastModifiedOn?.toISOString() || "N/A",
                      executionProperty: j?.ExecutionProperty,
                    } as GlueJob;
                  }),
                  Effect.catchAll(() => Effect.succeed(null)),
                  Effect.provide(config),
                  Effect.provide(AwsConfigLive),
                ),
              { concurrency: 5 },
            ),
            Effect.map((results) => results.filter((j): j is GlueJob => j !== null)),
          );
        }),
    }),
  ),
);
