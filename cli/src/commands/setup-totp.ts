import { setupTOTP } from "@cloudops-tools/sdk";
import { Command } from "@effect/cli";
import { Effect } from "effect";

export const setupTotpCommand = Command.make("setup-totp", {}, () =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => setupTOTP(),
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    });
  }),
).pipe(Command.withDescription("Configure TOTP secret for MFA"));
