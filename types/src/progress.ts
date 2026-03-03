/**
 * Progress event types.
 */
export enum ProgressEventType {
  /** Inventory generation started */
  STARTED = "started",
  /** Service scan started */
  SERVICE_STARTED = "service_started",
  /** Service scan completed */
  SERVICE_COMPLETED = "service_completed",
  /** Service scan failed */
  SERVICE_FAILED = "service_failed",
  /** Progress update with percentage */
  PROGRESS = "progress",
  /** File written to disk */
  FILE_WRITTEN = "file_written",
  /** Inventory generation completed */
  COMPLETED = "completed",
  /** Inventory generation failed */
  FAILED = "failed",
  /** General log message */
  LOG = "log",
  /** AWS login URL detected */
  LOGIN_URL = "login_url",
}

/**
 * Base progress event interface.
 */
export interface BaseProgressEvent {
  /** Type of the event */
  type: ProgressEventType;
  /** Timestamp when the event occurred */
  timestamp: string;
  /** Optional session ID to track multiple concurrent inventories */
  sessionId?: string;
}

/**
 * Started event - fired when inventory generation begins.
 */
export interface StartedEvent extends BaseProgressEvent {
  type: ProgressEventType.STARTED;
  /** Account name or ID */
  account: string;
  /** Region(s) being scanned */
  region: string;
  /** List of services to scan */
  services: string[];
  mode: string;
}

/**
 * Service started event - fired when a service scan begins.
 */
export interface ServiceStartedEvent extends BaseProgressEvent {
  type: ProgressEventType.SERVICE_STARTED;
  /** Service name (EC2, RDS, S3, etc.) */
  service: string;
  /** Region being scanned */
  region: string;
}

/**
 * Service completed event - fired when a service scan completes.
 */
export interface ServiceCompletedEvent extends BaseProgressEvent {
  type: ProgressEventType.SERVICE_COMPLETED;
  /** Service name */
  service: string;
  /** Region scanned */
  region: string;
  /** Number of resources found */
  resourceCount: number;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Service failed event - fired when a service scan fails.
 */
export interface ServiceFailedEvent extends BaseProgressEvent {
  type: ProgressEventType.SERVICE_FAILED;
  /** Service name */
  service: string;
  /** Region being scanned */
  region: string;
  /** Error message */
  error: string;
}

/**
 * Progress event - fired periodically with overall progress.
 */
export interface ProgressEvent extends BaseProgressEvent {
  type: ProgressEventType.PROGRESS;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current step description */
  message: string;
  /** Number of services completed */
  completed: number;
  /** Total number of services */
  total: number;
}

/**
 * File written event - fired when an output file is created.
 */
export interface FileWrittenEvent extends BaseProgressEvent {
  type: ProgressEventType.FILE_WRITTEN;
  /** Path to the file */
  filePath: string;
  /** File format (csv, xlsx, json) */
  format: string;
  /** File size in bytes */
  size: number;
}

/**
 * Completed event - fired when inventory generation completes successfully.
 */
export interface CompletedEvent extends BaseProgressEvent {
  type: ProgressEventType.COMPLETED;
  /** Total number of resources found */
  totalResources: number;
  /** Total duration in milliseconds */
  duration: number;
  /** Paths to output files */
  outputFiles: string[];
  /** Summary of resources by service */
  summary: Record<string, number>;
  /** Incremental scan statistics (when incremental mode is enabled) */
  incremental?: {
    newCount: number;
    changedCount: number;
    unchangedCount: number;
    removedCount: number;
  };
}

/**
 * Failed event - fired when inventory generation fails.
 */
export interface FailedEvent extends BaseProgressEvent {
  type: ProgressEventType.FAILED;
  /** Error message */
  error: string;
  /** Stack trace (optional) */
  stack?: string;
}

/**
 * Log event - general log message.
 */
export interface LogEvent extends BaseProgressEvent {
  type: ProgressEventType.LOG;
  /** Log level (info, warn, error) */
  level: "info" | "warn" | "error";
  /** Log message */
  message: string;
}

/**
 * Login URL event - fired when AWS login URL is detected.
 */
export interface LoginUrlEvent extends BaseProgressEvent {
  type: ProgressEventType.LOGIN_URL;
  /** The AWS SSO login URL */
  url: string;
  /** Region for the login */
  region: string;
  /** Optional message to display */
  message?: string;
}

/**
 * Union type of all progress events.
 */
export type InventoryProgressEvent =
  | StartedEvent
  | ServiceStartedEvent
  | ServiceCompletedEvent
  | ServiceFailedEvent
  | ProgressEvent
  | FileWrittenEvent
  | CompletedEvent
  | FailedEvent
  | LogEvent
  | LoginUrlEvent;
