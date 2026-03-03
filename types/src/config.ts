import type { InventoryMode } from "./inventory";

export type InventoryFormat = "csv" | "xlsx" | "json" | "both" | "all";

export interface CloudOpsConfig {
  defaultRegion?: string;
  defaultAccount?: string;
  defaultFormat?: InventoryFormat;
  defaultMode?: InventoryMode;
  defaultServices?: string[];
  showBanner?: boolean;
  skipGlobal?: boolean;
  onlyGlobal?: boolean;
}
