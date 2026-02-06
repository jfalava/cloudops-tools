import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Check if an AWS profile exists in the AWS config or credentials files
 * Returns the profile name to use with AWS_PROFILE environment variable
 */
export async function findAwsProfile(profileName: string): Promise<string | null> {
  const awsDir = join(homedir(), ".aws");
  const configPath = join(awsDir, "config");
  const credentialsPath = join(awsDir, "credentials");

  let configContent = "";
  try {
    configContent = await readFile(configPath, "utf-8");
  } catch {
    // Ignore
  }

  let credentialsContent = "";
  try {
    credentialsContent = await readFile(credentialsPath, "utf-8");
  } catch {
    // Ignore
  }

  const ssoProfileRegex = new RegExp(`^\\[profile\\s+${escapeRegex(profileName)}]`, "m");
  if (ssoProfileRegex.test(configContent)) {
    return profileName;
  }

  const credentialsProfileRegex = new RegExp(`^\\[${escapeRegex(profileName)}]`, "m");
  if (credentialsProfileRegex.test(credentialsContent)) {
    return profileName;
  }

  if (credentialsProfileRegex.test(configContent)) {
    return profileName;
  }

  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\\]/g, "\\$&");
}

export async function validateAwsProfile(profileName: string): Promise<void> {
  const profile = await findAwsProfile(profileName);

  if (!profile) {
    throw new Error(`AWS profile "${profileName}" not found.`);
  }
}
