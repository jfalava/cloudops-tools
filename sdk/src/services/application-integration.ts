import type { SQSQueue, SNSTopic } from "@cloudops-tools/types/aws";
import * as SNS from "distilled-aws/sns";
import * as SQS from "distilled-aws/sqs";
import { Context, Effect, Stream, Layer } from "effect";

import { makeRegionConfig, AwsConfigLive } from "../lib/aws-config";
import { asString, isObjectRecord } from "../lib/aws-payload";

export class AppIntegrationService extends Context.Tag("@sdk/services/AppIntegrationService")<
  AppIntegrationService,
  {
    readonly describeSQSQueues: (region: string) => Effect.Effect<SQSQueue[], unknown>;
    readonly describeSNSTopics: (region: string) => Effect.Effect<SNSTopic[], unknown>;
  }
>() {}

export const AppIntegrationServiceLive = Layer.effect(
  AppIntegrationService,
  Effect.succeed(
    AppIntegrationService.of({
      describeSQSQueues: (region: string) =>
        SQS.listQueues.items({}).pipe(
          Stream.map((url: unknown): SQSQueue => {
            const queueUrl = asString(url) ?? "unknown";
            return {
              queueUrl,
              queueName: queueUrl.split("/").pop() || queueUrl,
            };
          }),
          Stream.runCollect,
          Effect.map((c) => Array.from(c)),
          Effect.provide(makeRegionConfig(region)),
          Effect.provide(AwsConfigLive),
        ),

      describeSNSTopics: (region: string) =>
        SNS.listTopics.items({}).pipe(
          Stream.map((topic: unknown): SNSTopic => {
            const arn = isObjectRecord(topic) ? asString(topic.TopicArn) : undefined;
            const topicArn = arn ?? "unknown";
            return {
              topicArn,
              topicName: topicArn.split(":").pop() || topicArn,
            };
          }),
          Stream.runCollect,
          Effect.map((c) => Array.from(c)),
          Effect.provide(makeRegionConfig(region)),
          Effect.provide(AwsConfigLive),
        ),
    }),
  ),
);
