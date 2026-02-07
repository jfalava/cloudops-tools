import { generateTOTPToken, getTOTPSecret } from "@cloudops-tools/sdk";
import { Effect } from "effect";
import { spawn } from "node:child_process";
import process from "node:process";

async function ensureLetmeAvailable(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("letme", ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error("letme binary not found in PATH. Install letme and try again."));
        return;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      reject(new Error(`Failed to execute letme preflight check: ${message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const details = stderr.trim();
      reject(
        new Error(
          details ? `letme preflight check failed: ${details}` : "letme preflight check failed.",
        ),
      );
    });
  });
}

async function runLetmeObtain(profileName: string, otp: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("letme", ["obtain", profileName], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error: unknown) => {
      reject(new Error(`Failed to execute letme obtain: ${String(error)}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const details = stderr.trim() || stdout.trim();
      reject(
        new Error(
          details
            ? `letme obtain failed for "${profileName}": ${details}`
            : `letme obtain failed for "${profileName}"`,
        ),
      );
    });

    child.stdin.write(String(otp) + "\n");
    child.stdin.end();
  });
}

export const activateLetmeProfile = (profileName: string) =>
  Effect.gen(function* (_) {
    const normalizedProfileName = profileName.trim();
    if (!normalizedProfileName) {
      return yield* _(Effect.fail(new Error("--use-letme requires a non-empty profile name")));
    }

    yield* _(
      Effect.tryPromise({
        try: () => ensureLetmeAvailable(),
        catch: (error) => new Error(String(error)),
      }),
    );

    const secret = yield* _(
      Effect.tryPromise({
        try: () => getTOTPSecret(),
        catch: (error) => new Error(`Unable to read stored TOTP secret: ${String(error)}`),
      }),
    );

    const otp = yield* _(
      Effect.try({
        try: () => generateTOTPToken(secret),
        catch: (error) => new Error(`Unable to generate TOTP token: ${String(error)}`),
      }),
    );

    yield* _(
      Effect.tryPromise({
        try: () => runLetmeObtain(normalizedProfileName, otp),
        catch: (error) => new Error(String(error)),
      }),
    );

    yield* _(
      Effect.sync(() => {
        process.env.AWS_PROFILE = normalizedProfileName;
      }),
    );
  });
