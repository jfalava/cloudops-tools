import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createWebInventoryJson,
  writeInventoryWithJson,
  writeJsonInventoryFile,
  type WebInventoryData,
} from "../../../src/lib/json-output";
import type { EC2Instance } from "../../../src/types/aws-cli.types";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const parseJson = <T>(content: string): T => JSON.parse(content) as T;

const createMockServices = (): WebInventoryData["services"] => ({
  EC2: [
    {
      id: "i-0123456789abcdef0",
      name: "test-instance",
      type: "t3.micro",
      state: "running",
      region: "us-east-1",
      privateIp: "10.0.0.1",
      publicIp: "1.2.3.4",
      tags: { Name: "test-instance" },
    } as unknown as EC2Instance,
  ],
  S3: [],
  RDS: [],
  VPC: [],
  Subnet: [],
  SecurityGroup: [],
  LoadBalancer: [],
  Lambda: [],
  DynamoDB: [],
  ECS: [],
  EKS: [],
  CloudFront: [],
  Route53: [],
  IAMUser: [],
  IAMRole: [],
  Redshift: [],
  Glue: [],
  OpenSearch: [],
  KMS: [],
  CloudWatch: [],
  SecretsManager: [],
  ECR: [],
  InternetGateway: [],
  NatGateway: [],
  ElasticIP: [],
  VpnGateway: [],
  VpnConnection: [],
  TransitGateway: [],
  VpcEndpoint: [],
  VpcPeering: [],
  NetworkAcl: [],
  RouteTable: [],
  NetworkInterface: [],
  ControlTower: [],
  SCP: [],
  ConfigRules: [],
});

describe("createWebInventoryJson", () => {
  test("creates correct structure with metadata", () => {
    const services = createMockServices();
    const result = createWebInventoryJson("my-account", "us-east-1", "20251118", services);

    expect(result.metadata.account).toBe("my-account");
    expect(result.metadata.region).toBe("us-east-1");
    expect(result.metadata.timestamp).toBe("20251118");
    expect(result.metadata.version).toBe("0.3");
    expect(result.metadata.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("calculates correct summary counts", () => {
    const services = createMockServices();
    const result = createWebInventoryJson("account", "region", "20251118", services);

    expect(result.summary.totalResources).toBe(1);
    // All services are counted, even with 0 resources
    expect(result.summary.serviceCount).toBe(Object.keys(services).length);
    expect(result.summary.resourcesByService.EC2).toBe(1);
    expect(result.summary.resourcesByService.S3).toBe(0);
  });

  test("ignores undefined services in serviceCount", () => {
    const services: WebInventoryData["services"] = {
      EC2: [
        {
          id: "i-123",
          name: "test",
          type: "t3.micro",
          state: "running",
          region: "us-east-1",
          privateIp: "10.0.0.1",
          publicIp: undefined,
          tags: {},
        } as unknown as EC2Instance,
      ],
      S3: [],
      RDS: undefined,
    } as unknown as WebInventoryData["services"];

    const result = createWebInventoryJson("account", "region", "20251118", services);

    // EC2 has resources, S3 is empty array (still counted), RDS is undefined (not counted)
    expect(result.summary.serviceCount).toBe(2);
    expect(result.summary.totalResources).toBe(1);
  });

  test("handles empty services object", () => {
    const services: WebInventoryData["services"] = {} as WebInventoryData["services"];
    const result = createWebInventoryJson("account", "region", "20251118", services);

    expect(result.summary.totalResources).toBe(0);
    expect(result.summary.serviceCount).toBe(0);
  });

  test("handles multiple services with resources", () => {
    const services: WebInventoryData["services"] = {
      EC2: [
        {
          id: "i-1",
          name: "a",
          type: "t3.micro",
          state: "running",
          region: "us-east-1",
          privateIp: "10.0.0.1",
          tags: {},
        },
        {
          id: "i-2",
          name: "b",
          type: "t3.micro",
          state: "running",
          region: "us-east-1",
          privateIp: "10.0.0.2",
          tags: {},
        },
      ] as unknown as EC2Instance[],
      S3: [
        { name: "bucket1", region: "us-east-1" },
        { name: "bucket2", region: "us-east-1" },
      ],
      RDS: [],
    } as unknown as WebInventoryData["services"];

    const result = createWebInventoryJson("account", "region", "20251118", services);

    expect(result.summary.totalResources).toBe(4);
    // All 3 services are counted (empty arrays are still counted)
    expect(result.summary.serviceCount).toBe(3);
    expect(result.summary.resourcesByService.EC2).toBe(2);
    expect(result.summary.resourcesByService.S3).toBe(2);
    expect(result.summary.resourcesByService.RDS).toBe(0);
  });
});

describe("writeJsonInventoryFile", () => {
  test("writes valid JSON to file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const outputPath = join(tempDir, "test-inventory.json");

    try {
      const services = createMockServices();
      const data = createWebInventoryJson("my-account", "us-east-1", "20251118", services);
      await writeJsonInventoryFile(data, outputPath);

      const content = await readFile(outputPath, "utf-8");
      const parsed = parseJson<WebInventoryData>(content);

      expect(parsed.metadata.account).toBe("my-account");
      expect(parsed.summary.totalResources).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("adds .json extension if missing", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const basePath = join(tempDir, "inventory");

    try {
      const services = createMockServices();
      const data = createWebInventoryJson("account", "region", "20251118", services);
      await writeJsonInventoryFile(data, basePath);

      const content = await readFile(`${basePath}.json`, "utf-8");
      expect(JSON.parse(content)).toBeDefined();
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("does not duplicate .json extension", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const outputPath = join(tempDir, "inventory.json");

    try {
      const services = createMockServices();
      const data = createWebInventoryJson("account", "region", "20251118", services);
      await writeJsonInventoryFile(data, outputPath);

      const content = await readFile(outputPath, "utf-8");
      expect(JSON.parse(content)).toBeDefined();
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("file content parses back correctly", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const outputPath = join(tempDir, "inventory.json");

    try {
      const services = createMockServices();
      const originalData = createWebInventoryJson("my-account", "us-east-1", "20251118", services);
      await writeJsonInventoryFile(originalData, outputPath);

      const content = await readFile(outputPath, "utf-8");
      const parsed = JSON.parse(content) as WebInventoryData;

      expect(parsed.metadata).toEqual(originalData.metadata);
      expect(parsed.summary).toEqual(originalData.summary);
      expect(parsed.services.EC2).toHaveLength(1);
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });
});

describe("writeInventoryWithJson", () => {
  test("writes JSON when format is 'json'", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const basePath = join(tempDir, "inventory");

    try {
      const services = createMockServices();
      await writeInventoryWithJson({
        account: "my-account",
        region: "us-east-1",
        timestamp: "20251118",
        basePath,
        format: "json",
        services,
      });

      const content = await readFile(`${basePath}.json`, "utf-8");
      expect(JSON.parse(content)).toBeDefined();
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("writes JSON when format is 'all'", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const basePath = join(tempDir, "inventory");

    try {
      const services = createMockServices();
      await writeInventoryWithJson({
        account: "my-account",
        region: "us-east-1",
        timestamp: "20251118",
        basePath,
        format: "all",
        services,
      });

      const content = await readFile(`${basePath}.json`, "utf-8");
      expect(JSON.parse(content)).toBeDefined();
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("skips writing when format is 'csv'", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const basePath = join(tempDir, "inventory");

    try {
      const services = createMockServices();
      await writeInventoryWithJson({
        account: "my-account",
        region: "us-east-1",
        timestamp: "20251118",
        basePath,
        format: "csv",
        services,
      });

      let fileExists = true;
      try {
        await readFile(`${basePath}.json`, "utf-8");
      } catch {
        fileExists = false;
      }
      expect(fileExists).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("skips writing when format is 'xlsx'", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const basePath = join(tempDir, "inventory");

    try {
      const services = createMockServices();
      await writeInventoryWithJson({
        account: "my-account",
        region: "us-east-1",
        timestamp: "20251118",
        basePath,
        format: "xlsx",
        services,
      });

      let fileExists = true;
      try {
        await readFile(`${basePath}.json`, "utf-8");
      } catch {
        fileExists = false;
      }
      expect(fileExists).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  test("skips writing when format is 'both'", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "cloudops-test-"));
    const basePath = join(tempDir, "inventory");

    try {
      const services = createMockServices();
      await writeInventoryWithJson({
        account: "my-account",
        region: "us-east-1",
        timestamp: "20251118",
        basePath,
        format: "both",
        services,
      });

      let fileExists = true;
      try {
        await readFile(`${basePath}.json`, "utf-8");
      } catch {
        fileExists = false;
      }
      expect(fileExists).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });
});
