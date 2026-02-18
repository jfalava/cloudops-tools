import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "node:events";
import process from "node:process";

import { Effect } from "effect";

const otpToken = "123456";

const actualSdk = await import("@cloudops-tools/sdk");

type SpawnCall = {
  command: string;
  args: string[];
};

type SpawnMode = "success" | "preflight-enoent" | "obtain-fail";

type FakeChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: () => boolean;
  stdin: {
    write: (chunk: string | Buffer) => boolean;
    end: () => void;
  };
};

const spawnCalls: SpawnCall[] = [];
let receivedOtp = "";
let receivedProfile = "";
let spawnMode: SpawnMode = "success";
let secretError: Error | undefined;
let tokenError: Error | undefined;

const spawn = (command: string, args: string[] = []): FakeChild => {
  spawnCalls.push({ command, args: [...args] });

  const child = new EventEmitter() as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => true;

  let stdinBuffer = "";
  child.stdin = {
    write: (chunk) => {
      stdinBuffer += String(chunk);
      return true;
    },
    end: () => {
      if (args[0] === "obtain") {
        receivedProfile = args[1] ?? "";
        receivedOtp = stdinBuffer.replace(/\r?\n$/, "");
        if (spawnMode === "obtain-fail") {
          child.stderr.emit("data", "otp rejected");
          queueMicrotask(() => child.emit("close", 1));
          return;
        }
      }
      queueMicrotask(() => child.emit("close", 0));
    },
  };

  if (args[0] === "--version") {
    if (spawnMode === "preflight-enoent") {
      queueMicrotask(() =>
        child.emit("error", Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" })),
      );
      return child;
    }
    queueMicrotask(() => child.emit("close", 0));
  }

  return child;
};

void mock.module("@/lib/spawn", () => ({ spawn }));
void mock.module("@cloudops-tools/sdk", () => ({
  ...actualSdk,
  getTOTPSecret: async () => {
    if (secretError) {
      throw secretError;
    }
    return "JBSWY3DPEHPK3PXP";
  },
  generateTOTPToken: () => {
    if (tokenError) {
      throw tokenError;
    }
    return otpToken;
  },
}));

describe("letme", () => {
  let originalAwsProfile: string | undefined;

  beforeEach(() => {
    originalAwsProfile = process.env.AWS_PROFILE;
    spawnCalls.length = 0;
    receivedOtp = "";
    receivedProfile = "";
    spawnMode = "success";
    secretError = undefined;
    tokenError = undefined;
  });

  afterEach(() => {
    if (originalAwsProfile !== undefined) {
      process.env.AWS_PROFILE = originalAwsProfile;
    } else {
      delete process.env.AWS_PROFILE;
    }
  });

  afterAll(() => {
    mock.restore();
  });

  test("activates the letme profile and sets AWS_PROFILE", async () => {
    const { activateLetmeProfile } = await import("../../../src/lib/letme");

    await Effect.runPromise(activateLetmeProfile("  example-profile  "));

    expect(process.env.AWS_PROFILE).toBe("example-profile");
    expect(spawnCalls).toHaveLength(2);
    expect(receivedProfile).toBe("example-profile");
    expect(receivedOtp).toBe(otpToken);
  });

  test("fails for empty profile names", async () => {
    const { activateLetmeProfile } = await import("../../../src/lib/letme");

    try {
      await Effect.runPromise(activateLetmeProfile("   "));
      throw new Error("expected empty profile to fail");
    } catch (error) {
      expect(String(error)).toContain("--use-letme requires a non-empty profile name");
    }
    expect(spawnCalls).toHaveLength(0);
  });

  test("fails when letme binary is not installed", async () => {
    const { activateLetmeProfile } = await import("../../../src/lib/letme");
    spawnMode = "preflight-enoent";

    try {
      await Effect.runPromise(activateLetmeProfile("example-profile"));
      throw new Error("expected missing letme binary to fail");
    } catch (error) {
      expect(String(error)).toContain("letme binary not found in PATH");
    }
    expect(spawnCalls).toHaveLength(1);
  });

  test("fails when TOTP secret retrieval fails", async () => {
    const { activateLetmeProfile } = await import("../../../src/lib/letme");
    secretError = new Error("secret not configured");

    try {
      await Effect.runPromise(activateLetmeProfile("example-profile"));
      throw new Error("expected missing TOTP secret to fail");
    } catch (error) {
      expect(String(error)).toContain("Unable to read stored TOTP secret: secret not configured");
    }
    expect(spawnCalls).toHaveLength(1);
  });

  test("fails when OTP token generation fails", async () => {
    const { activateLetmeProfile } = await import("../../../src/lib/letme");
    tokenError = new Error("invalid secret");

    try {
      await Effect.runPromise(activateLetmeProfile("example-profile"));
      throw new Error("expected invalid TOTP secret to fail");
    } catch (error) {
      expect(String(error)).toContain("Unable to generate TOTP token: invalid secret");
    }
    expect(spawnCalls).toHaveLength(1);
  });

  test("fails when letme obtain returns non-zero exit code", async () => {
    const { activateLetmeProfile } = await import("../../../src/lib/letme");
    spawnMode = "obtain-fail";

    try {
      await Effect.runPromise(activateLetmeProfile("example-profile"));
      throw new Error("expected letme obtain failure");
    } catch (error) {
      expect(String(error)).toContain('letme obtain failed for "example-profile": otp rejected');
    }
    expect(spawnCalls).toHaveLength(2);
  });
});
