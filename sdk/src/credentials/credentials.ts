import type { AwsCredentialIdentityProvider } from "@aws-sdk/types";

import { fromIni, fromEnv } from "@aws-sdk/credential-providers";

/**
 * Credential management for AWS SDK clients
 *
 * Supports three authentication modes:
 * 1. Default credentials - AWS SDK default credential chain
 * 2. Named profiles - Uses AWS_PROFILE environment variable
 * 3. Letme with MFA - Uses credentials obtained via letme (via AWS_PROFILE)
 */

/**
 * Get AWS credentials provider based on current environment
 *
 * The provider will use:
 * - AWS_PROFILE if set (from --account flag or letme)
 * - Default credential chain otherwise (environment vars, EC2 instance profile, etc.)
 */
export function getCredentialsProvider(): AwsCredentialIdentityProvider {
  const awsProfile = process.env.AWS_PROFILE;

  if (awsProfile) {
    // Use the profile specified in AWS_PROFILE
    // This handles both:
    // 1. Named profiles (--account without --use-letme)
    // 2. Letme profiles (--use-letme sets AWS_PROFILE after obtaining creds)
    return fromIni({ profile: awsProfile });
  }

  // No profile specified, use default credential chain
  // This will check environment variables, ~/.aws/credentials, EC2 metadata, etc.
  return fromEnv();
}
