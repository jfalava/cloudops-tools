import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Effect } from "effect";
import { EventEmitter } from "node:events";
import process from "node:process";

const otpToken = "123456";

const actualSdk = await import("../../../../sdk/src/index.ts");

type SpawnCall = {
  command: string;
  args: string[];
};

type FakeChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: {
    write: (chunk: string | Buffer) => boolean;
    end: () => void;
  };
};

const spawnCalls: SpawnCall[] = [];
let receivedOtp = "";
let receivedProfile = "";

const spawn = (command: string, args: string[] = []): FakeChild => {
  spawnCalls.push({ command, args: [...args] });

  const child = new EventEmitter() as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();

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
      }
      queueMicrotask(() => child.emit("close", 0));
    },
  };

  if (args[0] === "--version") {
    queueMicrotask(() => child.emit("close", 0));
  }

  return child;
};

mock.module("@/lib/spawn", () => ({ spawn }));
mock.module("@cloudops-tools/sdk", () => ({
  ...actualSdk,
  getTOTPSecret: async () => "JBSWY3DPEHPK3PXP",
  generateTOTPToken: () => otpToken,
}));

describe("letme", () => {
  let originalAwsProfile: string | undefined;

  beforeEach(() => {
    originalAwsProfile = process.env.AWS_PROFILE;
    spawnCalls.length = 0;
    receivedOtp = "";
    receivedProfile = "";
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
});
