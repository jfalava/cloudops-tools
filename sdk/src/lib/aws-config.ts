import { FetchHttpClient } from "@effect/platform";
import { Credentials, Region } from "distilled-aws";
import { Layer } from "effect";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

import { getCredentialsProvider } from "../credentials/credentials";

/**
 * Provides the AWS Region.
 */
export const makeRegionConfig = (region: string) => Layer.succeed(Region.Region, region);

/**
 * Provides AWS Credentials by wrapping the existing standard provider.
 * This ensures 'letme' and profile support still work.
 */
export const CredentialsLive = Layer.effect(
  Credentials.Credentials,
  Effect.gen(function* (_) {
    const provider = getCredentialsProvider();
    const identity = yield* _(Effect.tryPromise(() => provider()));
    return Credentials.Credentials.of({
      accessKeyId: Redacted.make(identity.accessKeyId),
      secretAccessKey: Redacted.make(identity.secretAccessKey),
      sessionToken: identity.sessionToken ? Redacted.make(identity.sessionToken) : undefined,
      expiration: identity.expiration?.getTime(),
    });
  }),
);

/**
 * Default configuration including HttpClient.
 */
export const AwsConfigLive = Layer.mergeAll(
  CredentialsLive,
  Layer.succeed(Region.Region, process.env.AWS_REGION || "us-east-1"),
  FetchHttpClient.layer,
);
