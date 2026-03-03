/**
 * Progress event system for tracking inventory generation in real-time.
 * Provides an event emitter for streaming progress updates to WebSocket clients.
 *
 * @module lib/progress-events
 */

import { EventEmitter } from "node:events";

import { ProgressEventType, type InventoryProgressEvent } from "@cloudops-tools/types/progress";

export { ProgressEventType };
export type {
  BaseProgressEvent,
  StartedEvent,
  ServiceStartedEvent,
  ServiceCompletedEvent,
  ServiceFailedEvent,
  ProgressEvent,
  FileWrittenEvent,
  CompletedEvent,
  FailedEvent,
  LogEvent,
  LoginUrlEvent,
  InventoryProgressEvent,
} from "@cloudops-tools/types/progress";

/**
 * Global event emitter for inventory progress
 */
class InventoryProgressEmitter extends EventEmitter {
  /**
   * Emit a progress event
   */
  emitProgress(event: InventoryProgressEvent): void {
    this.emit("progress", event);

    // If running as a child process for the web server (indicated by session ID),
    // serialize event to stdout for parent process to consume.
    // We use a prefix to distinguish from normal log output.
    if (process.env.INVENTORY_SESSION_ID) {
      console.log(`[PROGRESS_JSON]${JSON.stringify(event)}`);
    }
  }

  /**
   * Subscribe to progress events
   */
  onProgress(handler: (event: InventoryProgressEvent) => void): void {
    this.on("progress", handler);
  }

  /**
   * Unsubscribe from progress events
   */
  offProgress(handler: (event: InventoryProgressEvent) => void): void {
    this.off("progress", handler);
  }

  /**
   * Subscribe to progress events for a specific session
   */
  onSessionProgress(sessionId: string, handler: (event: InventoryProgressEvent) => void): void {
    const wrappedHandler = (event: InventoryProgressEvent) => {
      if (event.sessionId === sessionId) {
        handler(event);
      }
    };
    this.on("progress", wrappedHandler);
  }
}

/**
 * Global singleton instance of the progress emitter
 */
export const progressEmitter = new InventoryProgressEmitter();

/**
 * Helper function to create a progress event with timestamp
 */
export function createProgressEvent<T extends InventoryProgressEvent>(
  type: ProgressEventType,
  data: Omit<T, "type" | "timestamp">,
): T {
  return {
    type,
    timestamp: new Date().toISOString(),
    ...data,
  } as T;
}
