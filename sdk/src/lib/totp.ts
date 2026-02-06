import os from "node:os";
import * as OTPAuth from "otpauth";

const SECRET_KEY = "aws_totp_secret";

/**
 * Detects if running inside WSL (Windows Subsystem for Linux)
 */
function isWSL(): boolean {
  try {
    const release = os.release().toLowerCase();
    return release.includes("microsoft") || release.includes("wsl");
  } catch {
    return false;
  }
}

/**
 * https://bun.com/docs/api/secrets
 */
export async function storeTOTPSecret(secret: string): Promise<void> {
  try {
    await Bun.secrets.set({
      service: "cloudops-tools-totp",
      name: SECRET_KEY,
      value: secret,
    });
  } catch (error) {
    throw new Error(`Failed to store TOTP secret: ${String(error)}`);
  }
}

export async function getTOTPSecret(): Promise<string> {
  try {
    const secret = await Bun.secrets.get({
      service: "cloudops-tools-totp",
      name: SECRET_KEY,
    });
    if (!secret) {
      throw new Error("TOTP secret not found. Run setup-totp first.");
    }
    return secret;
  } catch (error) {
    throw new Error(`Failed to retrieve TOTP secret: ${String(error)}`);
  }
}

export function generateTOTPToken(secret: string): string {
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    digits: 6,
    period: 30,
  });
  return totp.generate();
}

/**
 * Read password/secret input from stdin with hidden characters
 */
async function readHiddenInput(prompt: string): Promise<string> {
  process.stdout.write(prompt);

  return new Promise((resolve) => {
    const stdin = process.stdin;
    let input = "";
    let shouldExit = false;

    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }

    stdin.resume();
    stdin.setEncoding("utf8");

    const cleanup = () => {
      stdin.removeListener("data", onData);
      if (stdin.isTTY) {
        stdin.setRawMode(false);
      }
      stdin.pause();
    };

    const onData = (data: string) => {
      for (let i = 0; i < data.length; i++) {
        const char = data[i];
        if (!char) {
          continue;
        }
        const charCode = char.charCodeAt(0);

        if (charCode === 3) {
          cleanup();
          process.exit(130);
        }

        if (charCode === 13 || charCode === 10) {
          if (
            data.length === 1 ||
            (data.length === 2 && (data.charCodeAt(1) === 13 || data.charCodeAt(1) === 10))
          ) {
            shouldExit = true;
            break;
          }
          continue;
        }

        if (charCode === 127 || charCode === 8) {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }

        if (charCode < 32) {
          continue;
        }

        input += char;
        process.stdout.write("*");
      }

      if (shouldExit) {
        cleanup();
        process.stdout.write("\n");
        resolve(input.trim());
      }
    };

    stdin.on("data", onData);
  });
}

export async function setupTOTP(): Promise<void> {
  if (isWSL()) {
    console.warn("⚠️  WARNING: WSL Detected. Secret may not persist across reboots.");
  }

  const secret = await readHiddenInput("Enter your TOTP secret (base32 format): ");
  if (!secret) {
    throw new Error("Secret is required");
  }

  try {
    const token = generateTOTPToken(secret);
    console.log(`\nTest token generated: ${token}`);
  } catch {
    throw new Error("Invalid TOTP secret format");
  }

  await storeTOTPSecret(secret);
  console.log("\nTOTP setup complete");
}
