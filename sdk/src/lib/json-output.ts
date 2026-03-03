/**
 * JSON output formatter for web-friendly inventory data.
 * Structures AWS inventory data in a format optimized for React frontend consumption.
 *
 * @module json-output
 */

import type {
  WebInventoryData,
  WriteInventoryWithJsonInput,
} from "@cloudops-tools/types/inventory";

export type {
  InventoryMetadata,
  InventorySummary,
  WebInventoryData,
  WriteInventoryWithJsonInput,
} from "@cloudops-tools/types/inventory";

/**
 * Creates a web-friendly JSON structure from inventory data.
 * This function takes raw inventory data and structures it in a format
 * optimized for consumption by React frontends.
 *
 * @param account - AWS account name or ID
 * @param region - AWS region(s) inventoried
 * @param timestamp - Timestamp in YYYYMMDD format
 * @param services - Object containing arrays of resources by service type
 * @returns Complete structured inventory data
 *
 * @example
 * ```typescript
 * const jsonData = createWebInventoryJson(
 *   "my-account",
 *   "us-east-1",
 *   "20251118",
 *   {
 *     EC2: ec2Instances,
 *     RDS: rdsInstances,
 *     S3: s3Buckets
 *   }
 * );
 * ```
 */
export function createWebInventoryJson(
  account: string,
  region: string,
  timestamp: string,
  services: WebInventoryData["services"],
): WebInventoryData {
  // Calculate summary statistics
  const resourcesByService: Record<string, number> = {};
  let totalResources = 0;

  for (const [serviceName, resources] of Object.entries(services)) {
    if (resources && Array.isArray(resources)) {
      const count = resources.length;
      resourcesByService[serviceName] = count;
      totalResources += count;
    }
  }

  const serviceCount = Object.keys(resourcesByService).length;

  return {
    metadata: {
      account,
      region,
      timestamp,
      generatedAt: new Date().toISOString(),
      version: "0.3",
    },
    services,
    summary: {
      totalResources,
      serviceCount,
      resourcesByService,
    },
  };
}

/**
 * Writes inventory data as a JSON file.
 * Formats the JSON with 2-space indentation for readability.
 *
 * @param data - The web inventory data structure
 * @param outputPath - File path where JSON should be written (should end with .json)
 *
 * @example
 * ```typescript
 * const data = createWebInventoryJson(...);
 * await writeJsonInventoryFile(data, "output/inventory-us-east-1-20251118.json");
 * ```
 */
export async function writeJsonInventoryFile(
  data: WebInventoryData,
  outputPath: string,
): Promise<void> {
  const jsonPath = outputPath.endsWith(".json") ? outputPath : `${outputPath}.json`;

  // Pretty-print JSON with 2-space indentation for readability
  const jsonString = JSON.stringify(data, null, 2);

  await Bun.write(jsonPath, jsonString);
}

/**
 * Extends the existing writeInventoryFile functionality to support JSON output.
 * This is a helper that integrates with the existing CSV/XLSX export logic.
 *
 * @param account - AWS account name or ID
 * @param region - AWS region
 * @param timestamp - Timestamp in YYYYMMDD format
 * @param basePath - Base file path (without extension)
 * @param format - Export format: "csv", "xlsx", "json", "both" (csv+xlsx), or "all" (csv+xlsx+json)
 * @param services - Object containing arrays of resources by service type
 *
 * @example
 * ```typescript
 * await writeInventoryWithJson(
 *   "my-account",
 *   "us-east-1",
 *   "20251118",
 *   "output/inventory-us-east-1-20251118",
 *   "json",
 *   { EC2: ec2Instances, RDS: rdsInstances }
 * );
 * ```
 */
export async function writeInventoryWithJson(input: WriteInventoryWithJsonInput): Promise<void> {
  const shouldWriteJson = input.format === "json" || input.format === "all";

  if (shouldWriteJson) {
    const data = createWebInventoryJson(
      input.account,
      input.region,
      input.timestamp,
      input.services,
    );
    await writeJsonInventoryFile(data, input.basePath);
  }
}
