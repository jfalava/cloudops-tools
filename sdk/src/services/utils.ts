import * as EC2 from "distilled-aws/ec2";
import * as STS from "distilled-aws/sts";
import { Context, Effect, Layer } from "effect";

import { AwsConfigLive } from "../lib/aws-config";
import { asString, isObjectRecord, normalizeArray } from "../lib/aws-payload";

export interface UtilService {
  readonly getAccountId: () => Effect.Effect<string, unknown>;
  readonly getAllRegions: () => Effect.Effect<string[], unknown>;
}

export const UtilService = Context.GenericTag<UtilService>("@sdk/services/UtilService");

export const UtilServiceLive = Layer.succeed(
  UtilService,
  UtilService.of({
    getAccountId: () =>
      STS.getCallerIdentity({}).pipe(
        Effect.map((resp: unknown) =>
          isObjectRecord(resp) ? (asString(resp.Account) ?? "unknown") : "unknown",
        ),
        Effect.provide(AwsConfigLive),
      ),

    getAllRegions: () =>
      EC2.describeRegions({}).pipe(
        Effect.map((resp: unknown) => {
          if (!isObjectRecord(resp)) {
            return [];
          }

          return normalizeArray(resp.Regions).flatMap((region): string[] => {
            if (!isObjectRecord(region)) {
              return [];
            }

            const regionName = asString(region.RegionName);
            return regionName ? [regionName] : [];
          });
        }),
        Effect.provide(AwsConfigLive),
      ),
  }),
);
