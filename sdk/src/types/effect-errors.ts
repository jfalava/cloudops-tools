import { Data } from "effect";

import { asNumber, asString, isObjectRecord } from "../lib/aws-payload";

/**
 * Error type for AWS SDK errors with typed error classification.
 * Supports compile-time error handling and retryable error detection.
 */
export class AwsError extends Data.TaggedError("AwsError")<{
  readonly service: string;
  readonly region: string;
  readonly code: string;
  readonly message: string;
  readonly statusCode?: number;
  readonly cause: unknown;
}> {
  /**
   * Determines if this error should be retried based on AWS error codes and HTTP status.
   */
  get isRetryable(): boolean {
    return (
      [
        "Throttling",
        "TooManyRequestsException",
        "ServiceUnavailable",
        "RequestTimeout",
        "RequestTimeoutException",
        "InternalServerError",
        "InternalFailure",
      ].includes(this.code) || [500, 503, 504].includes(this.statusCode || 0)
    );
  }

  /**
   * Determines if this error is a credential/authentication error.
   */
  get isCredentialError(): boolean {
    return ["ExpiredToken", "InvalidClientTokenId", "AccessDenied"].includes(this.code);
  }

  /**
   * Converts an SDK error to a typed AwsError.
   */
  static fromSdkError(error: unknown, service: string, region: string): AwsError {
    const sdkError = isObjectRecord(error) ? error : undefined;
    const metadata =
      sdkError && isObjectRecord(sdkError.$metadata) ? sdkError.$metadata : undefined;
    const statusCode = metadata ? asNumber(metadata.httpStatusCode) : undefined;
    const code =
      asString(sdkError?.name) ?? (statusCode !== undefined ? String(statusCode) : "Unknown");
    const message = asString(sdkError?.message) ?? String(error);

    return new AwsError({
      service,
      region,
      code,
      message,
      statusCode,
      cause: error,
    });
  }
}

/**
 * Error type for file system operations.
 */
export class FileSystemError extends Data.TaggedError("FileSystemError")<{
  readonly operation: "read" | "write" | "delete";
  readonly path: string;
  readonly cause: unknown;
}> {}

/**
 * Error type for credential/authentication failures.
 */
export class CredentialError extends Data.TaggedError("CredentialError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Error type for validation failures.
 */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}
