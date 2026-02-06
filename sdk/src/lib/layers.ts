import { Layer } from "effect";

import { AnalyticsServiceLive } from "../services/analytics";
import { AppIntegrationServiceLive } from "../services/application-integration";
import { ComputeServiceLive } from "../services/compute";
import { DatabaseServiceLive } from "../services/database";
import { DeveloperToolsServiceLive } from "../services/developer-tools";
import { GovernanceServiceLive } from "../services/governance";
import { ManagementServiceLive } from "../services/management";
import { NetworkingServiceLive } from "../services/networking";
import { ReportingServiceLive } from "../services/reporting";
import { SecurityServiceLive } from "../services/security";
import { StorageServiceLive } from "../services/storage";
import { UtilServiceLive } from "../services/utils";
import { AwsConfigLive } from "./aws-config";
import { ConfigServiceLive } from "./config";

/**
 * All services provided manually to avoid circular dependencies and ensure proper initialization.
 */
const BaseServicesLive = Layer.mergeAll(
  UtilServiceLive,
  ComputeServiceLive,
  StorageServiceLive,
  DatabaseServiceLive,
  NetworkingServiceLive,
  SecurityServiceLive,
  DeveloperToolsServiceLive,
  ManagementServiceLive,
  GovernanceServiceLive,
  AppIntegrationServiceLive,
  AnalyticsServiceLive,
);

export const SdkLive = BaseServicesLive.pipe(
  Layer.provideMerge(AwsConfigLive),
  Layer.merge(ReportingServiceLive.pipe(Layer.provide(BaseServicesLive))),
  Layer.merge(ConfigServiceLive),
);
