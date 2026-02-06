import {
  progressEmitter,
  ProgressEventType,
  type InventoryProgressEvent,
} from "@cloudops-tools/sdk";
import process from "node:process";

import { ui } from "@/ui";

const spinnerFrames = ["|", "/", "-", "\\"];

const isTty = (): boolean => process.stdout?.isTTY === true;

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const makeBar = (percentage: number, width = 18): string => {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  return `[${"#".repeat(filled)}${"-".repeat(empty)}]`;
};

type ParsedErrorPayload = {
  errorTag?: string;
  errorData?: { Message?: string; RequestId?: string; Type?: string };
  message?: string;
};

const parseErrorPayload = (raw: string): ParsedErrorPayload | null => {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as ParsedErrorPayload;
  } catch {
    return null;
  }
};

const formatParsedError = (parsed: ParsedErrorPayload, fallback: string): string | null => {
  if (!parsed.errorTag && !parsed.errorData?.Message) {
    return null;
  }
  const parts = [parsed.errorTag, parsed.errorData?.Message || parsed.message].filter(Boolean);
  const base = parts.join(": ");
  const requestId = parsed.errorData?.RequestId;
  const type = parsed.errorData?.Type;
  const suffixParts = [
    type ? `Type=${type}` : null,
    requestId ? `RequestId=${requestId}` : null,
  ].filter(Boolean);
  const suffix = suffixParts.join(" ");
  return suffix ? `${base} (${suffix})` : base || fallback;
};

const prettifyError = (raw: string): string => {
  const parsed = parseErrorPayload(raw);
  if (!parsed) {
    return raw;
  }
  return formatParsedError(parsed, raw) ?? raw;
};

export const startProgressRenderer = (options?: { debug?: boolean }) => {
  const debug = options?.debug === true;
  let frame = 0;
  let lastLine = "";
  let startedAt = Date.now();
  let current = {
    percentage: 0,
    completed: 0,
    total: 0,
    message: "",
  };

  const clearLine = () => {
    if (!isTty()) {
      return;
    }
    const cols = process.stdout.columns ?? 80;
    process.stdout.write("\r" + " ".repeat(cols) + "\r");
  };

  const writeLine = (line: string) => {
    if (!isTty()) {
      process.stdout.write(String(line) + "\n");
      return;
    }
    const cols = process.stdout.columns ?? 80;
    const padded = line.length < cols ? line + " ".repeat(cols - line.length) : line;
    process.stdout.write("\r" + String(padded));
    lastLine = padded;
  };

  const render = () => {
    if (!isTty()) {
      return;
    }
    const spinner = spinnerFrames[frame % spinnerFrames.length];
    frame += 1;
    const bar = makeBar(current.percentage);
    const elapsed = formatDuration(Date.now() - startedAt);
    const line = `${spinner} ${ui.bold(bar)} ${ui.info(String(current.percentage).padStart(3, " "))}% ${ui.dim(`${current.completed}/${current.total}`)} ${ui.dim(elapsed)} ${current.message}`;
    if (line !== lastLine) {
      writeLine(line);
    }
  };

  const logEvent = (line: string) => {
    clearLine();
    process.stdout.write(String(line) + "\n");
    lastLine = "";
  };

  const renderSummary = (summary: Record<string, number>) => {
    const entries = Object.entries(summary).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      return;
    }
    logEvent(ui.bold("Summary"));
    for (const [name, count] of entries) {
      const label = ui.dim("󰈔");
      logEvent(`${label} ${name.padEnd(16)} ${ui.bold(String(count).padStart(6, " "))}`);
    }
  };

  type StartedEvent = Extract<InventoryProgressEvent, { type: ProgressEventType.STARTED }>;
  type ProgressEvent = Extract<InventoryProgressEvent, { type: ProgressEventType.PROGRESS }>;
  type ServiceCompletedEvent = Extract<
    InventoryProgressEvent,
    { type: ProgressEventType.SERVICE_COMPLETED }
  >;
  type ServiceFailedEvent = Extract<
    InventoryProgressEvent,
    { type: ProgressEventType.SERVICE_FAILED }
  >;
  type ServiceStartedEvent = Extract<
    InventoryProgressEvent,
    { type: ProgressEventType.SERVICE_STARTED }
  >;
  type FileWrittenEvent = Extract<InventoryProgressEvent, { type: ProgressEventType.FILE_WRITTEN }>;
  type CompletedEvent = Extract<InventoryProgressEvent, { type: ProgressEventType.COMPLETED }>;
  type FailedEvent = Extract<InventoryProgressEvent, { type: ProgressEventType.FAILED }>;
  type LogEvent = Extract<InventoryProgressEvent, { type: ProgressEventType.LOG }>;
  type LoginUrlEvent = Extract<InventoryProgressEvent, { type: ProgressEventType.LOGIN_URL }>;

  const handleStarted = (event: StartedEvent) => {
    startedAt = Date.now();
    current = { ...current, percentage: 0, completed: 0, total: 0, message: "starting..." };
    logEvent(ui.info(`Start ${event.account} ${event.region} (${event.mode})`));
  };

  const handleProgress = (event: ProgressEvent) => {
    current = {
      percentage: event.percentage,
      completed: event.completed,
      total: event.total,
      message: event.message,
    };
  };

  const handleServiceCompleted = (event: ServiceCompletedEvent) => {
    if (event.resourceCount === 0) {
      const msg = `${event.service}@${event.region} no resources`;
      logEvent(ui.info(`󰋼 ${msg}`));
      return;
    }
    const msg = `${event.service}@${event.region} ${event.resourceCount} items ${formatDuration(
      Number(event.duration),
    )}`;
    logEvent(ui.success(`󰄬 ${msg}`));
  };

  const handleServiceFailed = (event: ServiceFailedEvent) => {
    const firstLine = event.error.split("\n")[0] ?? event.error;
    const error = debug ? event.error : prettifyError(firstLine);
    const msg = `${event.service}@${event.region} ${error}`;
    if (!debug && error.includes("Transport error")) {
      logEvent(ui.info(`󰋼 ${msg} (check network/permissions)`));
      return;
    }
    logEvent(ui.error(`󰅚 ${msg}`));
  };

  const handleFileWritten = (event: FileWrittenEvent) => {
    logEvent(ui.info(`󰆓 ${event.format} ${event.filePath}`));
  };

  const handleServiceStarted = (event: ServiceStartedEvent) => {
    void event;
  };

  const handleLog = (event: LogEvent) => {
    void event;
  };

  const handleLoginUrl = (event: LoginUrlEvent) => {
    void event;
  };

  const handleCompleted = (event: CompletedEvent) => {
    const elapsed = formatDuration(event.duration);
    logEvent(ui.success(`󰄬 Done ${event.totalResources} resources in ${elapsed}`));
    renderSummary(event.summary);
    stop();
  };

  const handleFailed = (event: FailedEvent) => {
    logEvent(ui.error(`󰅚 Failed ${event.error}`));
    stop();
  };

  const onProgress = (event: InventoryProgressEvent) => {
    switch (event.type) {
      case ProgressEventType.STARTED:
        handleStarted(event);
        return;
      case ProgressEventType.PROGRESS:
        handleProgress(event);
        return;
      case ProgressEventType.SERVICE_STARTED:
        handleServiceStarted(event);
        return;
      case ProgressEventType.SERVICE_COMPLETED:
        handleServiceCompleted(event);
        return;
      case ProgressEventType.SERVICE_FAILED:
        handleServiceFailed(event);
        return;
      case ProgressEventType.FILE_WRITTEN:
        handleFileWritten(event);
        return;
      case ProgressEventType.COMPLETED:
        handleCompleted(event);
        return;
      case ProgressEventType.FAILED:
        handleFailed(event);
        return;
      case ProgressEventType.LOG:
        handleLog(event);
        return;
      case ProgressEventType.LOGIN_URL:
        handleLoginUrl(event);
        return;
      default:
        return;
    }
  };

  progressEmitter.onProgress(onProgress);
  const interval = setInterval(render, 80);

  const stop = () => {
    clearInterval(interval);
    progressEmitter.offProgress(onProgress);
    clearLine();
  };

  return { stop };
};
