import { $ as bunShell } from "bun";

/**
 * Find AWS CLI executable path
 * @returns AWS CLI path or null if not found
 */
export async function findAwsCliPath(): Promise<string | null> {
  const paths = ["aws"];
  if (process.platform === "win32") {
    paths.push("C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe");
  } else {
    paths.push("/usr/local/bin/aws", "/opt/homebrew/bin/aws");
  }

  for (const awsPath of paths) {
    try {
      await bunShell`${awsPath} --version`.quiet();
      return awsPath;
    } catch {
      continue;
    }
  }
  return null;
}

export async function isAwsCliAvailable(): Promise<boolean> {
  return (await findAwsCliPath()) !== null;
}

export async function getAwsCliVersion(): Promise<string | null> {
  const awsPath = await findAwsCliPath();
  if (!awsPath) {
    return null;
  }
  try {
    const result = await bunShell`${awsPath} --version`.quiet();
    const output = result.stdout.toString().trim() || result.stderr.toString().trim();
    const match = output.match(/aws-cli\/(\d+\.\d+\.\d+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
