import { setupTOTP } from "@cloudops-tools/sdk";
import { Command } from "@effect/cli";
import { Effect } from "effect";

export const setupTotpCommand = Command.make("setup-totp", {}, () =>
  Effect.gen(function* () {
    yield* Effect.promise(() => setupTOTP());
  }),
).pipe(Command.withDescription("Configure TOTP secret for MFA"));
