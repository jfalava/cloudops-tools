import { generateTOTPToken, getTOTPSecret } from "@cloudops-tools/sdk";
import { Effect, Option } from "effect";
import process from "node:process";

import { spawn } from "@/lib/spawn";

const LETME_TIMEOUT_MS = 30_000;

async function ensureLetmeAvailable(timeoutMs: number = LETME_TIMEOUT_MS): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("letme", ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let settled = false;
    let stderr = "";
    const onStderrData = (chunk: Buffer) => {
      stderr += chunk.toString();
    };
    const settle = (result: { ok: true } | { ok: false; error: Error }) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      child.removeListener("error", onError);
      child.removeListener("close", onClose);
      child.stderr.removeListener("data", onStderrData);
      if (result.ok) {
        resolve();
        return;
      }
      reject(result.error);
    };
    const timeout = setTimeout(() => {
      child.kill();
      settle({ ok: false, error: new Error("letme preflight check timed out") });
    }, timeoutMs);

    const onError = (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        settle({
          ok: false,
          error: new Error("letme binary not found in PATH. Install letme and try again."),
        });
        return;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      settle({
        ok: false,
        error: new Error(`Failed to execute letme preflight check: ${message}`),
      });
    };

    const onClose = (code: number | null) => {
      if (code === 0) {
        settle({ ok: true });
        return;
      }
      const details = stderr.trim();
      settle({
        ok: false,
        error: new Error(
          details ? `letme preflight check failed: ${details}` : "letme preflight check failed.",
        ),
      });
    };

    child.stderr.on("data", onStderrData);
    child.on("error", onError);
    child.on("close", onClose);
  });
}

async function runLetmeObtain(
  profileName: string,
  otp: string,
  timeoutMs: number = LETME_TIMEOUT_MS,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("letme", ["obtain", profileName], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let settled = false;
    let stdout = "";
    let stderr = "";

    const onStdoutData = (chunk: Buffer) => {
      stdout += chunk.toString();
    };
    const onStderrData = (chunk: Buffer) => {
      stderr += chunk.toString();
    };
    const settle = (result: { ok: true } | { ok: false; error: Error }) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      child.removeListener("error", onError);
      child.removeListener("close", onClose);
      child.stdout.removeListener("data", onStdoutData);
      child.stderr.removeListener("data", onStderrData);
      if (result.ok) {
        resolve();
        return;
      }
      reject(result.error);
    };
    const timeout = setTimeout(() => {
      child.kill();
      settle({
        ok: false,
        error: new Error(`letme obtain timed out for "${profileName}"`),
      });
    }, timeoutMs);

    const onError = (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      settle({ ok: false, error: new Error(`Failed to execute letme obtain: ${message}`) });
    };

    const onClose = (code: number | null) => {
      if (code === 0) {
        settle({ ok: true });
        return;
      }
      const details = stderr.trim() || stdout.trim();
      settle({
        ok: false,
        error: new Error(
          details
            ? `letme obtain failed for "${profileName}": ${details}`
            : `letme obtain failed for "${profileName}"`,
        ),
      });
    };

    child.stdout.on("data", onStdoutData);
    child.stderr.on("data", onStderrData);
    child.on("error", onError);
    child.on("close", onClose);
    child.stdin.write(String(otp) + "\n");
    child.stdin.end();
  });
}

export const activateLetmeProfile = (profileName: string) =>
  Effect.gen(function* () {
    const normalizedProfileName = profileName.trim();
    if (!normalizedProfileName) {
      return yield* Effect.fail(new Error("--use-letme requires a non-empty profile name"));
    }

    yield* Effect.tryPromise({
      try: () => ensureLetmeAvailable(),
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    });

    const secret = yield* Effect.tryPromise({
      try: () => getTOTPSecret(),
      catch: (error) =>
        new Error(
          `Unable to read stored TOTP secret: ${error instanceof Error ? error.message : String(error)}`,
        ),
    });

    const otp = yield* Effect.try({
      try: () => generateTOTPToken(secret),
      catch: (error) =>
        new Error(
          `Unable to generate TOTP token: ${error instanceof Error ? error.message : String(error)}`,
        ),
    });

    yield* Effect.tryPromise({
      try: () => runLetmeObtain(normalizedProfileName, otp),
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    });

    yield* Effect.sync(() => {
      process.env.AWS_PROFILE = normalizedProfileName;
    });
  });

export const requireLetmeActivation = (account: Option.Option<string>, example: string) =>
  Effect.gen(function* () {
    const letmeProfile = Option.getOrUndefined(account);
    if (!letmeProfile) {
      return yield* Effect.fail(
        new Error(`Missing required --account <profile> with --use-letme. Example: ${example}`),
      );
    }
    yield* activateLetmeProfile(letmeProfile);
  });
