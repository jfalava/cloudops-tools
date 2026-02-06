/**
 * Represents an Amazon EC2 instance with its configuration and metadata.
 */
export interface EC2Instance {
  id: string;
  name: string;
  state: string;
  type: string;
  privateIp: string;
  publicIp: string;
  vpcId?: string;
  tags?: Record<string, string>;
  launchTime?: string;
  encrypted?: boolean;
}

/**
 * Represents an Amazon RDS database instance with engine and configuration details.
 */
export interface RDSInstance {
  id: string;
  name: string;
  engine: string;
  engineVersion?: string;
  status: string;
  instanceClass?: string;
  storageSize?: number;
  vpcId?: string;
  publiclyAccessible?: boolean;
  encrypted?: boolean;
  createTime?: string;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon S3 bucket with security and versioning configuration.
 */
export interface S3Bucket {
  name: string;
  creationDate: string;
  region?: string;
  publicAccess?: boolean;
  encrypted?: boolean;
  versioningEnabled?: boolean;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon Virtual Private Cloud (VPC) network.
 */
export interface VPC {
  id: string;
  name: string;
  state: string;
  cidr: string;
  tags?: Record<string, string>;
}

/**
 * Represents a VPC subnet with IP address allocation and availability zone details.
 */
export interface Subnet {
  id: string;
  name: string;
  vpcId: string;
  cidr: string;
  availabilityZone: string;
  state?: string;
  availableIpAddressCount?: number;
  mapPublicIpOnLaunch?: boolean;
  tags?: Record<string, string>;
}

/**
 * Represents a VPC security group with firewall rules.
 */
export interface SecurityGroup {
  id: string;
  name: string;
  description: string;
  vpcId: string;
  ingressRulesCount?: number;
  egressRulesCount?: number;
  tags?: Record<string, string>;
}

/**
 * Represents an Elastic Load Balancer (Application, Network, or Gateway).
 */
export interface LoadBalancer {
  name: string;
  type: string;
  state: string;
  dnsName: string;
  arn?: string;
  scheme?: string;
  availabilityZones?: string[];
  vpcId?: string;
  createdTime?: string;
  tags?: Record<string, string>;
}

/**
 * Represents an AWS Lambda function with runtime and execution configuration.
 */
export interface LambdaFunction {
  name: string;
  runtime: string;
  handler: string;
  lastModified: string;
  memorySize?: number;
  timeout?: number;
  vpcId?: string;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon DynamoDB table with item count and encryption status.
 */
export interface DynamoDBTable {
  name: string;
  status: string;
  itemCount: number;
  createdDate?: string;
  sizeBytes?: number;
  encrypted?: boolean;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon ECS cluster with task and service counts.
 */
export interface ECSCluster {
  name: string;
  status: string;
  registeredContainerInstancesCount: number;
  runningTasksCount: number;
  pendingTasksCount?: number;
  activeServicesCount?: number;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon EKS Kubernetes cluster with version and endpoint information.
 */
export interface EKSCluster {
  name: string;
  status: string;
  version: string;
  arn?: string;
  createdAt?: string;
  endpoint?: string;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon CloudFront CDN distribution.
 */
export interface CloudFrontDistribution {
  id: string;
  domainName: string;
  status: string;
  enabled: boolean;
}

/**
 * Represents an Amazon Route 53 DNS hosted zone.
 */
export interface Route53HostedZone {
  id: string;
  name: string;
  privateZone: boolean;
}

/**
 * Represents an AWS IAM user account.
 */
export interface IAMUser {
  userName: string;
  userId: string;
  arn: string;
  createDate: string;
}

/**
 * Represents an AWS IAM role for service or user permissions.
 */
export interface IAMRole {
  roleName: string;
  roleId: string;
  arn: string;
  createDate: string;
}

/**
 * Represents an Amazon Redshift data warehouse cluster.
 */
export interface RedshiftCluster {
  clusterIdentifier: string;
  nodeType: string;
  clusterStatus: string;
  masterUsername: string;
  dbName: string;
  endpoint: string;
  port: number;
}

/**
 * Represents an AWS Glue ETL job.
 */
export interface GlueJob {
  name: string;
  description: string;
  role: string;
  createdOn: string;
  lastModifiedOn: string;
  executionProperty: unknown;
}

/**
 * Represents an Amazon OpenSearch Service domain.
 */
export interface OpenSearchDomain {
  domainName: string;
  arn: string;
  created: boolean;
  deleted: boolean;
  endpoint: string;
  multiAzWithStandbyEnabled: boolean;
  upgradeProcessing: boolean;
}

/**
 * Represents an AWS KMS encryption key.
 */
export interface KMSKey {
  keyId: string;
  keyArn: string;
  description: string;
  keyUsage: string;
  keyState: string;
  creationDate: string;
}

/**
 * Represents an Amazon CloudWatch alarm for monitoring metrics.
 */
export interface CloudWatchAlarm {
  alarmName: string;
  alarmDescription: string;
  stateValue: string;
  stateReason: string;
  metricName: string;
  namespace: string;
}

/**
 * Represents an AWS Secrets Manager secret for storing sensitive data.
 */
export interface SecretsManagerSecret {
  name: string;
  description: string;
  secretArn: string;
  createdDate: string;
  lastChangedDate: string;
}

/**
 * Represents an Amazon ECR container image repository.
 */
export interface ECRRepository {
  repositoryName: string;
  repositoryArn: string;
  registryId: string;
  createdAt: string;
}

/**
 * Represents a VPC Internet Gateway for outbound internet access.
 */
export interface InternetGateway {
  id: string;
  name: string;
  vpcId: string;
  state: string;
  tags?: Record<string, string>;
}

/**
 * Represents a VPC NAT Gateway for private subnet internet access.
 */
export interface NatGateway {
  id: string;
  name: string;
  vpcId: string;
  subnetId: string;
  state: string;
  publicIp: string;
  tags?: Record<string, string>;
}

/**
 * Represents an Elastic IP address allocation.
 */
export interface ElasticIP {
  allocationId: string;
  publicIp: string;
  domain: string;
  instanceId: string;
  networkInterfaceId: string;
  associationId: string;
  tags?: Record<string, string>;
}

/**
 * Represents a Virtual Private Gateway for VPN connections.
 */
export interface VpnGateway {
  id: string;
  name: string;
  type: string;
  state: string;
  vpcId: string;
  tags?: Record<string, string>;
}

/**
 * Represents a VPN connection between AWS and external network.
 */
export interface VpnConnection {
  id: string;
  name: string;
  state: string;
  vpnGatewayId: string;
  customerGatewayId: string;
  type: string;
  category: string;
  tags?: Record<string, string>;
}

/**
 * Represents an AWS Transit Gateway for multi-VPC and on-premises connectivity.
 */
export interface TransitGateway {
  id: string;
  name: string;
  state: string;
  ownerId: string;
  description: string;
  tags?: Record<string, string>;
}

/**
 * Represents a VPC endpoint for private AWS service access.
 */
export interface VpcEndpoint {
  id: string;
  name: string;
  vpcId: string;
  serviceName: string;
  type: string;
  state: string;
  tags?: Record<string, string>;
}

/**
 * Represents a VPC peering connection between two VPCs.
 */
export interface VpcPeeringConnection {
  id: string;
  name: string;
  status: string;
  requesterVpcId: string;
  accepterVpcId: string;
  tags?: Record<string, string>;
}

/**
 * Represents a VPC Network Access Control List (NACL).
 */
export interface NetworkAcl {
  id: string;
  name: string;
  vpcId: string;
  isDefault: boolean;
  tags?: Record<string, string>;
}

/**
 * Represents a VPC route table for network traffic routing.
 */
export interface RouteTable {
  id: string;
  name: string;
  vpcId: string;
  main: boolean;
  tags?: Record<string, string>;
}

/**
 * Represents an Elastic Network Interface (ENI).
 */
export interface NetworkInterface {
  id: string;
  name: string;
  vpcId: string;
  subnetId: string;
  privateIp: string;
  publicIp: string;
  status: string;
  tags?: Record<string, string>;
}

/**
 * Represents an AWS Control Tower guardrail (control) for governance.
 * Behavior can be DETECTIVE or PREVENTIVE.
 */
export interface ControlTowerGuardrail {
  guardrailArn: string;
  guardrailName: string;
  guardrailState: string;
  behavior: string;
  organizationalUnitArn: string;
}

/**
 * Represents an AWS Organizations Service Control Policy (SCP).
 */
export interface ServiceControlPolicy {
  id: string;
  arn: string;
  name: string;
  description: string;
  type: string;
  awsManaged: boolean;
}

/**
 * Represents an AWS Config rule for compliance monitoring.
 * Source can be AWS managed or custom.
 */
export interface ConfigRule {
  configRuleName: string;
  configRuleArn: string;
  configRuleId: string;
  description: string;
  complianceStatus: string;
  source: string;
}

/**
 * Represents an Amazon EBS volume for block storage.
 */
export interface EBSVolume {
  volumeId: string;
  name: string;
  size: number;
  volumeType: string;
  state: string;
  encrypted: boolean;
  availabilityZone: string;
  createTime?: string;
  attachments?: unknown[];
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon ElastiCache cluster (Redis or Memcached).
 */
export interface ElastiCacheCluster {
  cacheClusterId: string;
  cacheNodeType: string;
  engine: string;
  engineVersion?: string;
  cacheClusterStatus: string;
  numCacheNodes: number;
  preferredAvailabilityZone?: string;
  cacheClusterCreateTime?: string;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon SQS message queue.
 */
export interface SQSQueue {
  queueUrl: string;
  queueName: string;
  attributes?: Record<string, string>;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon SNS notification topic.
 */
export interface SNSTopic {
  topicArn: string;
  topicName: string;
  subscriptionsConfirmed?: number;
  tags?: Record<string, string>;
}

/**
 * Represents an EC2 Auto Scaling group for automatic capacity management.
 */
export interface AutoScalingGroup {
  autoScalingGroupName: string;
  minSize: number;
  maxSize: number;
  desiredCapacity: number;
  availabilityZones: string[];
  healthCheckType: string;
  createdTime?: string;
  tags?: Record<string, string>;
}

/**
 * Represents an AWS CloudFormation infrastructure stack.
 */
export interface CloudFormationStack {
  stackName: string;
  stackId: string;
  stackStatus: string;
  creationTime?: string;
  lastUpdatedTime?: string;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon EFS elastic file system.
 */
export interface EFSFileSystem {
  fileSystemId: string;
  name: string;
  lifeCycleState: string;
  sizeInBytes?: number;
  creationTime?: string;
  encrypted: boolean;
  performanceMode: string;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon API Gateway REST or HTTP API.
 */
export interface APIGateway {
  id: string;
  name: string;
  protocolType: string;
  apiEndpoint?: string;
  createdDate?: string;
  tags?: Record<string, string>;
}

/**
 * Represents an AWS Step Functions state machine for workflow orchestration.
 */
export interface StepFunction {
  stateMachineArn: string;
  name: string;
  type: string;
  status: string;
  creationDate?: string;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon EventBridge rule for event-driven automation.
 */
export interface EventBridgeRule {
  name: string;
  arn: string;
  state: string;
  description?: string;
  eventPattern?: string;
  tags?: Record<string, string>;
}

/**
 * Represents an AWS CloudTrail audit log trail.
 */
export interface CloudTrail {
  name: string;
  trailARN: string;
  homeRegion?: string;
  isMultiRegionTrail?: boolean;
  isOrganizationTrail?: boolean;
  s3BucketName?: string;
  logFileValidationEnabled?: boolean;
  tags?: Record<string, string>;
}

/**
 * Represents an AWS Systems Manager Parameter Store parameter.
 */
export interface SSMParameter {
  name: string;
  type: string;
  value?: string;
  version?: number;
  lastModifiedDate?: string;
  arn?: string;
  tags?: Record<string, string>;
}

/**
 * Represents an AWS Backup vault for storing backup recovery points.
 */
export interface BackupVault {
  backupVaultName: string;
  backupVaultArn: string;
  creationDate?: string;
  encryptionKeyArn?: string;
  numberOfRecoveryPoints?: number;
  locked?: boolean;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon Cognito user pool for authentication.
 */
export interface CognitoUserPool {
  id: string;
  name: string;
  status?: string;
  creationDate?: string;
  lastModifiedDate?: string;
  mfaConfiguration?: string;
  tags?: Record<string, string>;
}

/**
 * Represents an AWS WAF web application firewall access control list.
 */
export interface WAFWebACL {
  name: string;
  id: string;
  arn: string;
  description?: string;
  scope?: string;
  capacity?: number;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon GuardDuty threat detection detector.
 */
export interface GuardDutyDetector {
  detectorId: string;
  status: string;
  serviceRole?: string;
  createdAt?: string;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon Kinesis data stream for real-time data processing.
 */
export interface KinesisStream {
  streamName: string;
  streamARN: string;
  streamStatus: string;
  retentionPeriodHours?: number;
  streamCreationTimestamp?: string;
  shardCount?: number;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon Athena workgroup for SQL query execution.
 */
export interface AthenaWorkgroup {
  name: string;
  state: string;
  description?: string;
  creationTime?: string;
  tags?: Record<string, string>;
}

/**
 * Represents an Amazon EMR big data processing cluster.
 */
export interface EMRCluster {
  id: string;
  name: string;
  status: string;
  creationDateTime?: string;
  releaseLabel?: string;
  instanceCount?: number;
  tags?: Record<string, string>;
}

/**
 * Represents an App Runner service.
 */
export interface AppRunnerService {
  name: string;
  arn: string;
  status?: string;
  createdAt?: string;
}

/**
 * Represents an AWS Batch compute environment.
 */
export interface BatchComputeEnvironment {
  name: string;
  arn: string;
  state?: string;
  status?: string;
  type?: string;
}

/**
 * Represents an Amazon EMR Serverless application.
 */
export interface EMRServerlessApplication {
  id: string;
  name?: string;
  status?: string;
  releaseLabel?: string;
  createdAt?: string;
}

/**
 * Represents an Amazon Lightsail instance.
 */
export interface LightsailInstance {
  name: string;
  arn?: string;
  state?: string;
  blueprintId?: string;
  createdAt?: string;
}

/**
 * Represents an Elastic Beanstalk environment.
 */
export interface ElasticBeanstalkEnvironment {
  name: string;
  id: string;
  status?: string;
  health?: string;
  tier?: string;
}

/**
 * Represents a SageMaker domain.
 */
export interface SageMakerDomain {
  id: string;
  name: string;
  status?: string;
}

/**
 * Represents a DocumentDB cluster.
 */
export interface DocDBCluster {
  id: string;
  arn?: string;
  status?: string;
  engine?: string;
}

/**
 * Represents a Neptune cluster.
 */
export interface NeptuneCluster {
  id: string;
  arn?: string;
  status?: string;
}

/**
 * Represents a MemoryDB cluster.
 */
export interface MemoryDBCluster {
  name: string;
  arn?: string;
  status?: string;
  nodeType?: string;
}

/**
 * Represents a DAX cluster.
 */
export interface DAXCluster {
  name: string;
  arn?: string;
  status?: string;
  nodeType?: string;
}

/**
 * Represents a Timestream database.
 */
export interface TimestreamDatabase {
  name: string;
  arn?: string;
  status?: string;
  createdAt?: string;
}

/**
 * Represents a Keyspaces keyspace.
 */
export interface KeyspacesKeyspace {
  name: string;
  arn?: string;
}

/**
 * Represents a Redshift Serverless namespace.
 */
export interface RedshiftServerlessNamespace {
  name: string;
  arn?: string;
  status?: string;
}

/**
 * Represents an OpenSearch Serverless collection.
 */
export interface OpenSearchServerlessCollection {
  name: string;
  id?: string;
  status?: string;
}

/**
 * Represents an API Gateway v2 API.
 */
export interface APIGatewayV2Api {
  id: string;
  name: string;
  protocolType?: string;
  apiEndpoint?: string;
}

/**
 * Represents a Global Accelerator accelerator.
 */
export interface GlobalAccelerator {
  name: string;
  arn?: string;
  status?: string;
}

/**
 * Represents a Direct Connect connection.
 */
export interface DirectConnectConnection {
  id: string;
  name?: string;
  state?: string;
}

/**
 * Represents a VPC Lattice service.
 */
export interface VpcLatticeService {
  id: string;
  name: string;
  arn?: string;
  status?: string;
}

/**
 * Represents a Route53 domain.
 */
export interface Route53Domain {
  domainName: string;
  autoRenew?: boolean;
  transferLock?: boolean;
}

/**
 * Represents an FSx file system.
 */
export interface FsxFileSystem {
  id: string;
  arn?: string;
  type?: string;
  storageCapacity?: number;
}

/**
 * Represents a Glacier vault.
 */
export interface GlacierVault {
  name: string;
  arn?: string;
  creationDate?: string;
  numberOfArchives?: number;
}

/**
 * Represents a Storage Gateway gateway.
 */
export interface StorageGateway {
  id: string;
  arn?: string;
  type?: string;
  state?: string;
}

/**
 * Represents a Backup Gateway gateway.
 */
export interface BackupGateway {
  name: string;
  arn?: string;
  state?: string;
}

/**
 * Represents an Rbin retention rule.
 */
export interface RbinRule {
  id: string;
  arn?: string;
  resourceType?: string;
  status?: string;
}
