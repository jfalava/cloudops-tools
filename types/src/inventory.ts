import type {
  CloudFrontDistribution,
  CloudWatchAlarm,
  ConfigRule,
  ControlTowerGuardrail,
  DynamoDBTable,
  EC2Instance,
  ECRRepository,
  ECSCluster,
  EKSCluster,
  ElasticIP,
  GlueJob,
  IAMRole,
  IAMUser,
  InternetGateway,
  KMSKey,
  LambdaFunction,
  LoadBalancer,
  NatGateway,
  NetworkAcl,
  NetworkInterface,
  OpenSearchDomain,
  RDSInstance,
  RedshiftCluster,
  Route53HostedZone,
  RouteTable,
  S3Bucket,
  SecretsManagerSecret,
  SecurityGroup,
  ServiceControlPolicy,
  Subnet,
  TransitGateway,
  VPC,
  VpcEndpoint,
  VpcPeeringConnection,
  VpnConnection,
  VpnGateway,
} from "./aws.js";

export type InventoryMode = "basic" | "detailed" | "security" | "cost";

export interface ConsolidatedResource {
  type: string;
  name: string;
  region: string;
  arn: string;
  state?: string;
  tags?: string;
  createdDate?: string;
  publicAccess?: string;
  size?: string;
  encrypted?: string;
  vpcId?: string;
  lastActivity?: string;
  versionStatus?: string;
}

export interface InventoryResource {
  readonly type: string;
  readonly name: string;
  readonly region: string;
  readonly arn: string;
  readonly state?: string;
  readonly tags?: string;
  readonly createdDate?: string;
  readonly publicAccess?: string;
  readonly size?: string;
  readonly encrypted?: string;
  readonly vpcId?: string;
  readonly lastActivity?: string;
  readonly versionStatus?: string;
}

export interface InventoryRun {
  readonly id: number;
  readonly accountId: string;
  readonly timestamp: string;
  readonly runAt: string;
  readonly mode: string;
  readonly totalResources: number;
}

export interface ResourceRecord {
  readonly id: number;
  readonly runId: number;
  readonly type: string;
  readonly name: string;
  readonly region: string;
  readonly arn: string;
  readonly state: string | null;
  readonly tags: string | null;
  readonly createdDate: string | null;
  readonly publicAccess: string | null;
  readonly size: string | null;
  readonly encrypted: string | null;
  readonly vpcId: string | null;
  readonly lastActivity: string | null;
  readonly versionStatus: string | null;
}

export interface ResourceChange {
  readonly type: string;
  readonly name: string;
  readonly region: string;
  readonly change: "added" | "removed" | "modified";
  readonly oldValue: string | null;
  readonly newValue: string | null;
}

export interface IncrementalResult {
  readonly newResources: InventoryResource[];
  readonly changedResources: InventoryResource[];
  readonly unchangedCount: number;
  readonly removedCount: number;
}

export interface DescribeCacheEntry {
  readonly id: number;
  readonly resourceType: string;
  readonly region: string;
  readonly data: string;
  readonly cachedAt: string;
  readonly ttlSeconds: number;
}

export interface ScanDedupResult {
  readonly shouldSkip: boolean;
  readonly lastRunAt: string | null;
  readonly minutesSinceLastRun: number | null;
}

/**
 * Metadata about the inventory collection process.
 */
export interface InventoryMetadata {
  /** AWS account name or ID */
  account: string;
  /** AWS region(s) inventoried */
  region: string;
  /** Timestamp in YYYYMMDD format */
  timestamp: string;
  /** ISO 8601 timestamp of when the inventory was generated */
  generatedAt: string;
  /** Version of the inventory tool */
  version?: string;
}

/**
 * Summary statistics about the inventory.
 */
export interface InventorySummary {
  /** Total number of resources across all services */
  totalResources: number;
  /** Number of services that have resources */
  serviceCount: number;
  /** Breakdown of resource count by service */
  resourcesByService: Record<string, number>;
}

export interface WebInventoryServices {
  EC2?: EC2Instance[];
  RDS?: RDSInstance[];
  S3?: S3Bucket[];
  VPC?: VPC[];
  Subnet?: Subnet[];
  SecurityGroup?: SecurityGroup[];
  LoadBalancer?: LoadBalancer[];
  Lambda?: LambdaFunction[];
  DynamoDB?: DynamoDBTable[];
  ECS?: ECSCluster[];
  EKS?: EKSCluster[];
  CloudFront?: CloudFrontDistribution[];
  Route53?: Route53HostedZone[];
  IAMUser?: IAMUser[];
  IAMRole?: IAMRole[];
  Redshift?: RedshiftCluster[];
  Glue?: GlueJob[];
  OpenSearch?: OpenSearchDomain[];
  KMS?: KMSKey[];
  CloudWatch?: CloudWatchAlarm[];
  SecretsManager?: SecretsManagerSecret[];
  ECR?: ECRRepository[];
  InternetGateway?: InternetGateway[];
  NatGateway?: NatGateway[];
  ElasticIP?: ElasticIP[];
  VpnGateway?: VpnGateway[];
  VpnConnection?: VpnConnection[];
  TransitGateway?: TransitGateway[];
  VpcEndpoint?: VpcEndpoint[];
  VpcPeering?: VpcPeeringConnection[];
  NetworkAcl?: NetworkAcl[];
  RouteTable?: RouteTable[];
  NetworkInterface?: NetworkInterface[];
  ControlTower?: ControlTowerGuardrail[];
  SCP?: ServiceControlPolicy[];
  ConfigRules?: ConfigRule[];
}

/**
 * Complete inventory data structure optimized for web consumption.
 */
export interface WebInventoryData {
  /** Metadata about the inventory */
  metadata: InventoryMetadata;
  /** All resources organized by service type */
  services: WebInventoryServices;
  /** Summary statistics */
  summary: InventorySummary;
}

export type WriteInventoryWithJsonInput = {
  account: string;
  region: string;
  timestamp: string;
  basePath: string;
  format: string;
  services: WebInventoryServices;
};

/**
 * Canonical regional service names scanned by inventory runs.
 */
export const ALL_REGIONAL_SERVICES = [
  "EC2",
  "RDS",
  "Lambda",
  "VPC",
  "Subnet",
  "SecurityGroup",
  "LoadBalancer",
  "ECS",
  "EKS",
  "EBS",
  "EFS",
  "FSx",
  "ElastiCache",
  "DAX",
  "DocDB",
  "Neptune",
  "MemoryDB",
  "Timestream",
  "Keyspaces",
  "RedshiftServerless",
  "OpenSearchServerless",
  "SQS",
  "SNS",
  "ECR",
  "CloudWatch",
  "SSM",
  "KMS",
  "SecretsManager",
  "AppRunner",
  "Batch",
  "EMR",
  "EMRServerless",
  "Lightsail",
  "ElasticBeanstalk",
  "SageMaker",
  "APIGateway",
  "APIGatewayV2",
  "VpcLattice",
  "StorageGateway",
  "BackupGateway",
  "BackupVault",
  "Glacier",
  "Rbin",
] as const;

/**
 * Canonical global service names scanned by inventory runs.
 */
export const ALL_GLOBAL_SERVICES = [
  "S3",
  "IAMUser",
  "IAMRole",
  "CloudFront",
  "Route53",
  "Route53Domains",
  "GlobalAccelerator",
  "DirectConnect",
  "SCP",
] as const;

export type RegionalService = (typeof ALL_REGIONAL_SERVICES)[number];
export type GlobalService = (typeof ALL_GLOBAL_SERVICES)[number];
export type ServiceName = RegionalService | GlobalService;
