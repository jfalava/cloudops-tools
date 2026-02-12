#!/usr/bin/env bun
/* eslint-disable no-console */

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

type SummaryPart = {
  readonly kind?: string;
  readonly text?: string;
};

type CommentShape = {
  readonly summary?: SummaryPart[];
};

type SourceShape = {
  readonly fileName?: string;
  readonly line?: number;
};

type TypeShape = {
  readonly type?: string;
  readonly name?: string;
  readonly value?: JsonValue;
  readonly elementType?: TypeShape;
  readonly types?: TypeShape[];
  readonly elements?: TypeShape[];
  readonly target?: number | { readonly packageName?: string; readonly qualifiedName?: string };
};

type ParameterShape = {
  readonly name?: string;
  readonly type?: TypeShape;
  readonly flags?: { readonly isOptional?: boolean };
};

type SignatureShape = {
  readonly parameters?: ParameterShape[];
  readonly type?: TypeShape;
};

type ReflectionShape = {
  readonly name?: string;
  readonly kind?: number;
  readonly children?: ReflectionShape[];
  readonly signatures?: SignatureShape[];
  readonly comment?: CommentShape;
  readonly sources?: SourceShape[];
};

type ProjectShape = {
  readonly children?: ReflectionShape[];
};

const moduleSpecs = [
  {
    typedocName: "index",
    slug: "core",
    pageTitle: "Core",
    importPath: "@cloudops-tools/sdk",
  },
  {
    typedocName: "operations",
    slug: "operations",
    pageTitle: "Operations",
    importPath: "@cloudops-tools/sdk/operations",
  },
  {
    typedocName: "services",
    slug: "services",
    pageTitle: "Services",
    importPath: "@cloudops-tools/sdk/services",
  },
  {
    typedocName: "lib",
    slug: "lib",
    pageTitle: "Utilities",
    importPath: "@cloudops-tools/sdk/lib",
  },
  {
    typedocName: "types",
    slug: "types",
    pageTitle: "Types",
    importPath: "@cloudops-tools/sdk/types",
  },
  {
    typedocName: "credentials",
    slug: "credentials",
    pageTitle: "Credentials",
    importPath: "@cloudops-tools/sdk/credentials",
  },
] as const;

function asObject(value: JsonValue | undefined): JsonObject | undefined {
  return value && isJsonObject(value) ? value : undefined;
}

function asArray(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (typeof value === "object") {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

function isReflectionShape(value: JsonValue): value is ReflectionShape {
  return isJsonObject(value);
}

function readProject(filePath: string): ProjectShape {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (!isJsonValue(parsed)) {
    return {
      children: [],
    };
  }
  const project = asObject(parsed);
  return {
    children: asArray(project?.children).filter(isReflectionShape),
  };
}

function reflectionKind(kind?: number): string {
  switch (kind) {
    case 8:
      return "Enum";
    case 32:
      return "Variable";
    case 64:
      return "Function";
    case 128:
      return "Class";
    case 256:
      return "Interface";
    case 2048:
      return "Method";
    case 2097152:
      return "Type Alias";
    default:
      return "Symbol";
  }
}

function flattenSummary(comment?: CommentShape): string {
  if (!comment?.summary || comment.summary.length === 0) {
    return "No summary available.";
  }

  const text = comment.summary
    .map((part) => (part.kind === "text" ? (part.text ?? "") : ""))
    .join("")
    .replaceAll("\n", " ")
    .trim();

  return text.length > 0 ? text : "No summary available.";
}

const typeFormatters: Record<string, (type: TypeShape) => string> = {
  intrinsic: (type) => type.name ?? "unknown",
  reference: (type) => type.name ?? "unknown",
  array: (type) => `${formatType(type.elementType)}[]`,
  union: (type) => (type.types ?? []).map((item) => formatType(item)).join(" | ") || "unknown",
  intersection: (type) =>
    (type.types ?? []).map((item) => formatType(item)).join(" & ") || "unknown",
  tuple: (type) => `[${(type.elements ?? []).map((item) => formatType(item)).join(", ")}]`,
  literal: (type) => JSON.stringify(type.value),
  reflection: () => "{ ... }",
  query: () => "typeof ...",
};

function formatType(type?: TypeShape): string {
  if (!type) {
    return "unknown";
  }

  const formatter = type.type ? typeFormatters[type.type] : undefined;
  return formatter ? formatter(type) : (type.name ?? type.type ?? "unknown");
}

function formatSignature(symbol: ReflectionShape): string | undefined {
  const signature = symbol.signatures?.[0];
  if (!signature) {
    return undefined;
  }

  const params = (signature.parameters ?? [])
    .map((parameter) => {
      const name = parameter.name ?? "arg";
      const optional = parameter.flags?.isOptional ? "?" : "";
      return `${name}${optional}: ${formatType(parameter.type)}`;
    })
    .join(", ");

  return `${symbol.name ?? "symbol"}(${params}): ${formatType(signature.type)}`;
}

function escapeTableCell(text: string): string {
  return text.replaceAll("|", "\\|");
}

function sourceRef(source?: SourceShape): string {
  const fileName = source?.fileName;
  const line = source?.line;
  if (!fileName || !line) {
    return "-";
  }
  return `\`${fileName}:${line}\``;
}

function renderModuleSection(moduleName: string, symbols: ReflectionShape[]): string {
  const lines: string[] = [];
  lines.push(`## \`${moduleName}\``);
  lines.push("");

  if (symbols.length === 0) {
    lines.push("No exported symbols found.");
    lines.push("");
    return lines.join("\n");
  }

  lines.push("| Name | Kind | Description | Source |");
  lines.push("| ---- | ---- | ----------- | ------ |");

  for (const symbol of symbols) {
    const name = escapeTableCell(`\`${symbol.name ?? "unknown"}\``);
    const kind = reflectionKind(symbol.kind);
    const summary = escapeTableCell(flattenSummary(symbol.comment));
    const source = sourceRef(symbol.sources?.[0]);
    lines.push(`| ${name} | ${kind} | ${summary} | ${source} |`);
  }

  lines.push("");
  lines.push("### Signatures");
  lines.push("");

  const signatures = symbols
    .map((symbol) => formatSignature(symbol))
    .filter((signature): signature is string => Boolean(signature));

  if (signatures.length === 0) {
    lines.push("No callable signatures in this entry point.");
    lines.push("");
    return lines.join("\n");
  }

  lines.push("```ts");
  for (const signature of signatures) {
    lines.push(signature);
  }
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

function renderModulePage(
  pageTitle: string,
  importPath: string,
  generatedAt: string,
  symbols: ReflectionShape[],
): string {
  const lines: string[] = [
    "---",
    `title: API - ${pageTitle}`,
    `description: Auto-generated API reference for ${importPath}`,
    "---",
    "",
    `# API - ${pageTitle}`,
    "",
    `Import path: \`${importPath}\``,
    "",
    "Generated from TypeDoc.",
    "",
    `Generated at: \`${generatedAt}\``,
    "",
    renderModuleSection(importPath, symbols),
  ];

  return String(lines.join("\n").trimEnd());
}

function renderApiIndexPage(
  generatedAt: string,
  modules: readonly {
    readonly pageTitle: string;
    readonly slug: string;
    readonly importPath: string;
  }[],
): string {
  const lines: string[] = [
    "---",
    "title: API Reference",
    "description: Auto-generated SDK API reference organized by entry point",
    "---",
    "",
    "# API Reference",
    "",
    "This section is generated from SDK TypeScript sources using TypeDoc.",
    "",
    `Generated at: \`${generatedAt}\``,
    "",
    "## Entry Points",
    "",
  ];

  for (const module of modules) {
    lines.push(`- [${module.pageTitle}](/docs/sdk/api/${module.slug}) - \`${module.importPath}\``);
  }

  lines.push("");
  return String(lines.join("\n").trimEnd());
}

function renderApiMeta(modules: readonly { readonly slug: string }[]): string {
  const pages = ["index", ...modules.map((module) => module.slug)];
  const meta = {
    title: "API Reference",
    pages,
  };

  return String(JSON.stringify(meta, null, 2));
}

function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const docsDir = resolve(scriptDir, "..");
  const repoRoot = resolve(docsDir, "..");
  const typedocBin = resolve(docsDir, "node_modules/.bin/typedoc");
  const typedocJsonPath = resolve(docsDir, ".generated/sdk-api.json");
  const apiDir = resolve(docsDir, "content/docs/sdk/api");
  const legacyApiReferencePath = resolve(docsDir, "content/docs/sdk/api-reference.mdx");

  mkdirSync(dirname(typedocJsonPath), { recursive: true });
  mkdirSync(apiDir, { recursive: true });

  const typedocArgs = [
    "--json",
    typedocJsonPath,
    "--entryPoints",
    resolve(repoRoot, "sdk/src/index.ts"),
    resolve(repoRoot, "sdk/src/operations/index.ts"),
    resolve(repoRoot, "sdk/src/services/index.ts"),
    resolve(repoRoot, "sdk/src/lib/index.ts"),
    resolve(repoRoot, "sdk/src/types/index.ts"),
    resolve(repoRoot, "sdk/src/credentials/index.ts"),
    "--tsconfig",
    resolve(repoRoot, "sdk/tsconfig.json"),
    "--excludePrivate",
    "--excludeInternal",
    "--excludeExternals",
    "--skipErrorChecking",
  ];

  const command = spawnSync(typedocBin, typedocArgs, {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (command.status !== 0) {
    console.error(command.stdout);
    console.error(command.stderr);
    throw new Error(`TypeDoc command failed with exit code ${command.status ?? -1}`);
  }

  const project = readProject(typedocJsonPath);
  const modulesByName = new Map<string, ReflectionShape>();
  for (const child of project.children ?? []) {
    if (child.name) {
      modulesByName.set(child.name, child);
    }
  }

  const generatedAt = new Date().toISOString();
  const modules = moduleSpecs.map((module) => {
    const moduleNode = modulesByName.get(module.typedocName);
    const symbols = (moduleNode?.children ?? []).filter((symbol) => symbol.name !== "default");
    return {
      ...module,
      symbols,
    };
  });

  const indexContent = renderApiIndexPage(generatedAt, modules);
  const metaContent = renderApiMeta(modules);

  writeFileSync(resolve(apiDir, "index.mdx"), indexContent, "utf8");
  writeFileSync(resolve(apiDir, "meta.json"), metaContent, "utf8");

  for (const module of modules) {
    const content = renderModulePage(
      module.pageTitle,
      module.importPath,
      generatedAt,
      module.symbols,
    );
    writeFileSync(resolve(apiDir, `${module.slug}.mdx`), content, "utf8");
  }

  rmSync(legacyApiReferencePath, { force: true });
  console.log(`Generated API docs in ${apiDir}`);
}

main();
