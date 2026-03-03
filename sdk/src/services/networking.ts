import type {
  VPC,
  Subnet,
  SecurityGroup,
  LoadBalancer,
  InternetGateway,
  NatGateway,
  ElasticIP,
  VpnGateway,
  VpnConnection,
  TransitGateway,
  VpcEndpoint,
  VpcPeeringConnection,
  NetworkAcl,
  RouteTable,
  NetworkInterface,
  GlobalAccelerator as GlobalAcceleratorType,
  DirectConnectConnection,
  VpcLatticeService,
} from "@cloudops-tools/types/aws";
import * as DirectConnect from "distilled-aws/direct-connect";
import * as EC2 from "distilled-aws/ec2";
import * as ELBv2 from "distilled-aws/elastic-load-balancing-v2";
import * as VPCLattice from "distilled-aws/vpc-lattice";
import { Context, Effect, Stream, Layer } from "effect";

import { makeRegionConfig, AwsConfigLive } from "../lib/aws-config";
import { describeGlobalAccelerators as patchedGlobalAccelerators } from "../patches";

type UnknownRecord = Record<string, unknown>;
type AwsTag = { Key?: string; Value?: string };

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

const getString = (record: UnknownRecord, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
};

const getBoolean = (record: UnknownRecord, key: string): boolean | undefined => {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
};

const getNumber = (record: UnknownRecord, key: string): number | undefined => {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
};

const getArray = (record: UnknownRecord, key: string): unknown[] => {
  const value = record[key];
  return Array.isArray(value) ? value : [];
};

const getRecord = (record: UnknownRecord, key: string): UnknownRecord | undefined => {
  const value = record[key];
  return isRecord(value) ? value : undefined;
};

const getDateISOString = (record: UnknownRecord, key: string): string | undefined => {
  const value = record[key];
  return value instanceof Date ? value.toISOString() : undefined;
};

const toTags = (value: unknown): AwsTag[] =>
  Array.isArray(value)
    ? value.map((entry) => {
        const tag = asRecord(entry);
        return {
          Key: getString(tag, "Key"),
          Value: getString(tag, "Value"),
        };
      })
    : [];

const mapTags = (value: unknown): Record<string, string> =>
  toTags(value).reduce(
    (acc, tag) => {
      if (tag.Key) {
        acc[tag.Key] = tag.Value ?? "";
      }
      return acc;
    },
    {} as Record<string, string>,
  );

const getNameTag = (value: unknown): string | undefined =>
  toTags(value).find((tag) => tag.Key === "Name")?.Value;

export interface NetworkingService {
  readonly describeVPCs: (region: string) => Effect.Effect<VPC[], unknown>;
  readonly getVPCDetails: (region: string, vpcId: string) => Effect.Effect<unknown, unknown>;
  readonly describeSubnets: (region: string) => Effect.Effect<Subnet[], unknown>;
  readonly describeSecurityGroups: (region: string) => Effect.Effect<SecurityGroup[], unknown>;
  readonly describeLoadBalancers: (region: string) => Effect.Effect<LoadBalancer[], unknown>;
  readonly describeInternetGateways: (region: string) => Effect.Effect<InternetGateway[], unknown>;
  readonly describeNatGateways: (region: string) => Effect.Effect<NatGateway[], unknown>;
  readonly describeElasticIPs: (region: string) => Effect.Effect<ElasticIP[], unknown>;
  readonly describeVpnGateways: (region: string) => Effect.Effect<VpnGateway[], unknown>;
  readonly describeVpnConnections: (region: string) => Effect.Effect<VpnConnection[], unknown>;
  readonly describeTransitGateways: (region: string) => Effect.Effect<TransitGateway[], unknown>;
  readonly describeVpcEndpoints: (region: string) => Effect.Effect<VpcEndpoint[], unknown>;
  readonly describeVpcPeeringConnections: (
    region: string,
  ) => Effect.Effect<VpcPeeringConnection[], unknown>;
  readonly describeNetworkAcls: (region: string) => Effect.Effect<NetworkAcl[], unknown>;
  readonly describeRouteTables: (region: string) => Effect.Effect<RouteTable[], unknown>;
  readonly describeNetworkInterfaces: (
    region: string,
  ) => Effect.Effect<NetworkInterface[], unknown>;
  readonly describeGlobalAccelerators: (
    region: string,
  ) => Effect.Effect<GlobalAcceleratorType[], unknown>;
  readonly describeDirectConnectConnections: (
    region: string,
  ) => Effect.Effect<DirectConnectConnection[], unknown>;
  readonly describeVpcLatticeServices: (
    region: string,
  ) => Effect.Effect<VpcLatticeService[], unknown>;
}

export const NetworkingService = Context.GenericTag<NetworkingService>(
  "@sdk/services/NetworkingService",
);

export const NetworkingServiceLive = Layer.succeed(
  NetworkingService,
  NetworkingService.of({
    describeVPCs: (region: string) => {
      return EC2.describeVpcs.items({}).pipe(
        Stream.map((v): VPC => {
          const record = asRecord(v);
          const tags = getArray(record, "Tags");
          return {
            id: getString(record, "VpcId") ?? "unknown",
            name: getNameTag(tags) ?? "N/A",
            state: getString(record, "State") ?? "unknown",
            cidr: getString(record, "CidrBlock") ?? "N/A",
            tags: mapTags(tags),
          };
        }),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      );
    },

    getVPCDetails: (region: string, vpcId: string) =>
      EC2.describeVpcs({ VpcIds: [vpcId] }).pipe(
        Effect.map((resp) => {
          const record = asRecord(resp);
          const vpcs = getArray(record, "Vpcs");
          return vpcs[0];
        }),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeSubnets: (region: string) =>
      EC2.describeSubnets.items({}).pipe(
        Stream.map((s): Subnet => {
          const record = asRecord(s);
          const tags = getArray(record, "Tags");
          return {
            id: getString(record, "SubnetId") ?? "unknown",
            name: getNameTag(tags) ?? "N/A",
            vpcId: getString(record, "VpcId") ?? "N/A",
            cidr: getString(record, "CidrBlock") ?? "N/A",
            availabilityZone: getString(record, "AvailabilityZone") ?? "N/A",
            state: getString(record, "State"),
            availableIpAddressCount: getNumber(record, "AvailableIpAddressCount"),
            mapPublicIpOnLaunch: getBoolean(record, "MapPublicIpOnLaunch"),
            tags: mapTags(tags),
          };
        }),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeSecurityGroups: (region: string) =>
      EC2.describeSecurityGroups.items({}).pipe(
        Stream.map((sg): SecurityGroup => {
          const record = asRecord(sg);
          return {
            id: getString(record, "GroupId") ?? "unknown",
            name: getString(record, "GroupName") ?? "unknown",
            description: getString(record, "Description") ?? "N/A",
            vpcId: getString(record, "VpcId") ?? "N/A",
            ingressRulesCount: getArray(record, "IpPermissions").length,
            egressRulesCount: getArray(record, "IpPermissionsEgress").length,
            tags: mapTags(getArray(record, "Tags")),
          };
        }),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeLoadBalancers: (region: string) =>
      Effect.gen(function* (_) {
        const config = makeRegionConfig(region);
        const lbs = yield* _(
          ELBv2.describeLoadBalancers.items({}).pipe(
            Stream.map((lb): LoadBalancer => {
              const record = asRecord(lb);
              const state = getRecord(record, "State");
              return {
                name: getString(record, "LoadBalancerName") ?? "unknown",
                type: getString(record, "Type") ?? "unknown",
                state: state ? (getString(state, "Code") ?? "unknown") : "unknown",
                dnsName: getString(record, "DNSName") ?? "N/A",
                arn: getString(record, "LoadBalancerArn"),
                scheme: getString(record, "Scheme"),
                availabilityZones: getArray(record, "AvailabilityZones").map((az) => {
                  const zone = asRecord(az);
                  return getString(zone, "ZoneName") ?? "";
                }),
                vpcId: getString(record, "VpcId"),
                createdTime: getDateISOString(record, "CreatedTime"),
              };
            }),
            Stream.runCollect,
            Effect.map((c) => Array.from(c)),
            Effect.provide(config),
            Effect.provide(AwsConfigLive),
          ),
        );

        if (lbs.length === 0) {
          return [];
        }

        return yield* _(
          Effect.forEach(
            lbs,
            (lb) =>
              Effect.gen(function* (__inner) {
                if (!lb.arn) {
                  return lb;
                }
                const tagsResp = yield* __inner(
                  ELBv2.describeTags({ ResourceArns: [lb.arn] }).pipe(
                    Effect.catchAll(() => Effect.succeed({ TagDescriptions: [] })),
                    Effect.provide(config),
                    Effect.provide(AwsConfigLive),
                  ),
                );
                const tagDescriptions = getArray(asRecord(tagsResp), "TagDescriptions");
                const first = tagDescriptions[0];
                const tags = mapTags(getArray(asRecord(first), "Tags"));
                return { ...lb, tags };
              }),
            { concurrency: 5 },
          ),
        );
      }),

    describeInternetGateways: (region: string) =>
      EC2.describeInternetGateways.items({}).pipe(
        Stream.map((igw): InternetGateway => {
          const record = asRecord(igw);
          const tags = getArray(record, "Tags");
          const attachment = asRecord(getArray(record, "Attachments")[0]);
          return {
            id: getString(record, "InternetGatewayId") ?? "unknown",
            name: getNameTag(tags) ?? "N/A",
            vpcId: getString(attachment, "VpcId") ?? "N/A",
            state: getString(attachment, "State") ?? "unknown",
            tags: mapTags(tags),
          };
        }),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeNatGateways: (region: string) =>
      EC2.describeNatGateways.items({}).pipe(
        Stream.map((ngw): NatGateway => {
          const record = asRecord(ngw);
          const tags = getArray(record, "Tags");
          const firstAddress = asRecord(getArray(record, "NatGatewayAddresses")[0]);
          return {
            id: getString(record, "NatGatewayId") ?? "unknown",
            name: getNameTag(tags) ?? "N/A",
            vpcId: getString(record, "VpcId") ?? "N/A",
            subnetId: getString(record, "SubnetId") ?? "N/A",
            state: getString(record, "State") ?? "unknown",
            publicIp: getString(firstAddress, "PublicIp") ?? "N/A",
            tags: mapTags(tags),
          };
        }),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeElasticIPs: (region: string) =>
      EC2.describeAddresses({}).pipe(
        Effect.map((resp) => {
          const addresses = getArray(asRecord(resp), "Addresses");
          return addresses.map((a): ElasticIP => {
            const record = asRecord(a);
            return {
              allocationId: getString(record, "AllocationId") ?? "N/A",
              publicIp: getString(record, "PublicIp") ?? "N/A",
              domain: getString(record, "Domain") ?? "N/A",
              instanceId: getString(record, "InstanceId") ?? "N/A",
              networkInterfaceId: getString(record, "NetworkInterfaceId") ?? "N/A",
              associationId: getString(record, "AssociationId") ?? "N/A",
              tags: mapTags(getArray(record, "Tags")),
            };
          });
        }),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeVpnGateways: (region: string) =>
      EC2.describeVpnGateways({}).pipe(
        Effect.map((resp) => {
          const vpnGateways = getArray(asRecord(resp), "VpnGateways");
          return vpnGateways.map((v): VpnGateway => {
            const record = asRecord(v);
            const tags = getArray(record, "Tags");
            const firstAttachment = asRecord(getArray(record, "VpcAttachments")[0]);
            return {
              id: getString(record, "VpnGatewayId") ?? "unknown",
              name: getNameTag(tags) ?? "N/A",
              type: getString(record, "Type") ?? "unknown",
              state: getString(record, "State") ?? "unknown",
              vpcId: getString(firstAttachment, "VpcId") ?? "N/A",
              tags: mapTags(tags),
            };
          });
        }),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeVpnConnections: (region: string) =>
      EC2.describeVpnConnections({}).pipe(
        Effect.map((resp) => {
          const vpnConnections = getArray(asRecord(resp), "VpnConnections");
          return vpnConnections.map((v): VpnConnection => {
            const record = asRecord(v);
            const tags = getArray(record, "Tags");
            return {
              id: getString(record, "VpnConnectionId") ?? "unknown",
              name: getNameTag(tags) ?? "N/A",
              state: getString(record, "State") ?? "unknown",
              vpnGatewayId: getString(record, "VpnGatewayId") ?? "N/A",
              customerGatewayId: getString(record, "CustomerGatewayId") ?? "N/A",
              type: getString(record, "Type") ?? "unknown",
              category: getString(record, "Category") ?? "N/A",
              tags: mapTags(tags),
            };
          });
        }),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeTransitGateways: (region: string) =>
      EC2.describeTransitGateways.items({}).pipe(
        Stream.map((tgw): TransitGateway => {
          const record = asRecord(tgw);
          const tags = getArray(record, "Tags");
          return {
            id: getString(record, "TransitGatewayId") ?? "unknown",
            name: getNameTag(tags) ?? "N/A",
            state: getString(record, "State") ?? "unknown",
            ownerId: getString(record, "OwnerId") ?? "N/A",
            description: getString(record, "Description") ?? "N/A",
            tags: mapTags(tags),
          };
        }),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeVpcEndpoints: (region: string) =>
      EC2.describeVpcEndpoints.items({}).pipe(
        Stream.map((ve): VpcEndpoint => {
          const record = asRecord(ve);
          const tags = getArray(record, "Tags");
          return {
            id: getString(record, "VpcEndpointId") ?? "unknown",
            name: getNameTag(tags) ?? "N/A",
            vpcId: getString(record, "VpcId") ?? "N/A",
            serviceName: getString(record, "ServiceName") ?? "N/A",
            type: getString(record, "VpcEndpointType") ?? "unknown",
            state: getString(record, "State") ?? "unknown",
            tags: mapTags(tags),
          };
        }),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeVpcPeeringConnections: (region: string) =>
      EC2.describeVpcPeeringConnections.items({}).pipe(
        Stream.map((vpcp): VpcPeeringConnection => {
          const record = asRecord(vpcp);
          const tags = getArray(record, "Tags");
          const status = getRecord(record, "Status");
          const requester = getRecord(record, "RequesterVpcInfo");
          const accepter = getRecord(record, "AccepterVpcInfo");
          return {
            id: getString(record, "VpcPeeringConnectionId") ?? "unknown",
            name: getNameTag(tags) ?? "N/A",
            status: status ? (getString(status, "Code") ?? "unknown") : "unknown",
            requesterVpcId: requester ? (getString(requester, "VpcId") ?? "N/A") : "N/A",
            accepterVpcId: accepter ? (getString(accepter, "VpcId") ?? "N/A") : "N/A",
            tags: mapTags(tags),
          };
        }),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeNetworkAcls: (region: string) =>
      EC2.describeNetworkAcls.items({}).pipe(
        Stream.map((nacl): NetworkAcl => {
          const record = asRecord(nacl);
          const tags = getArray(record, "Tags");
          return {
            id: getString(record, "NetworkAclId") ?? "unknown",
            name: getNameTag(tags) ?? "N/A",
            vpcId: getString(record, "VpcId") ?? "N/A",
            isDefault: getBoolean(record, "IsDefault") ?? false,
            tags: mapTags(tags),
          };
        }),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeRouteTables: (region: string) =>
      EC2.describeRouteTables.items({}).pipe(
        Stream.map((rt): RouteTable => {
          const record = asRecord(rt);
          const associations = getArray(record, "Associations");
          return {
            id: getString(record, "RouteTableId") ?? "unknown",
            name: getNameTag(getArray(record, "Tags")) ?? "N/A",
            vpcId: getString(record, "VpcId") ?? "N/A",
            main: associations.some((association) => getBoolean(asRecord(association), "Main")),
            tags: mapTags(getArray(record, "Tags")),
          };
        }),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeNetworkInterfaces: (region: string) =>
      EC2.describeNetworkInterfaces.items({}).pipe(
        Stream.map((ni): NetworkInterface => {
          const record = asRecord(ni);
          const tagSet = getArray(record, "TagSet");
          const association = getRecord(record, "Association");
          return {
            id: getString(record, "NetworkInterfaceId") ?? "unknown",
            name: getNameTag(tagSet) ?? "N/A",
            vpcId: getString(record, "VpcId") ?? "N/A",
            subnetId: getString(record, "SubnetId") ?? "N/A",
            privateIp: getString(record, "PrivateIpAddress") ?? "N/A",
            publicIp: association ? (getString(association, "PublicIp") ?? "N/A") : "N/A",
            status: getString(record, "Status") ?? "unknown",
            tags: mapTags(tagSet),
          };
        }),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeGlobalAccelerators: (_region: string) => patchedGlobalAccelerators(),

    describeDirectConnectConnections: (region: string) =>
      DirectConnect.describeConnections({}).pipe(
        Effect.map((r) =>
          getArray(asRecord(r), "connections").map((c): DirectConnectConnection => {
            const record = asRecord(c);
            return {
              id: getString(record, "connectionId") ?? "unknown",
              name: getString(record, "connectionName"),
              state: getString(record, "connectionState"),
            };
          }),
        ),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),

    describeVpcLatticeServices: (region: string) =>
      VPCLattice.listServices.items({}).pipe(
        Stream.map((s): VpcLatticeService => {
          const record = asRecord(s);
          return {
            id: getString(record, "Id") ?? "unknown",
            name: getString(record, "Name") ?? "unknown",
            arn: getString(record, "Arn"),
            status: getString(record, "Status"),
          };
        }),
        Stream.runCollect,
        Effect.map((c) => Array.from(c)),
        Effect.provide(makeRegionConfig(region)),
        Effect.provide(AwsConfigLive),
      ),
  }),
);
