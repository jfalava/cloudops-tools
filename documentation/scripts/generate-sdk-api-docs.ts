#!/usr/bin/env bun
/* eslint-disable no-console */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    typedocName: "sdk/src",
    slug: "core",
    pageTitles: { en: "Core", es: "Núcleo" },
    importPath: "@cloudops-tools/sdk",
  },
  {
    typedocName: "sdk/src/operations",
    slug: "operations",
    pageTitles: { en: "Operations", es: "Operaciones" },
    importPath: "@cloudops-tools/sdk/operations",
  },
  {
    typedocName: "sdk/src/services",
    slug: "services",
    pageTitles: { en: "Services", es: "Servicios" },
    importPath: "@cloudops-tools/sdk/services",
  },
  {
    typedocName: "sdk/src/lib",
    slug: "lib",
    pageTitles: { en: "Utilities", es: "Utilidades" },
    importPath: "@cloudops-tools/sdk/lib",
  },
  {
    typedocName: "types/src",
    slug: "types",
    pageTitles: { en: "Types", es: "Tipos" },
    importPath: "@cloudops-tools/types",
  },
  {
    typedocName: "sdk/src/credentials",
    slug: "credentials",
    pageTitles: { en: "Credentials", es: "Credenciales" },
    importPath: "@cloudops-tools/sdk/credentials",
  },
] as const;

type LocaleCode = "en" | "es";

type LocaleStrings = {
  readonly code: LocaleCode;
  readonly routePrefix: string;
  readonly indexTitle: string;
  readonly indexDescription: string;
  readonly indexHeading: string;
  readonly indexIntro: string;
  readonly generatedAtLabel: string;
  readonly entryPointsHeading: string;
  readonly moduleFrontmatterTitle: (pageTitle: string) => string;
  readonly moduleFrontmatterDescription: (importPath: string) => string;
  readonly moduleHeading: (pageTitle: string) => string;
  readonly importPathLabel: string;
  readonly generatedFromTypedoc: string;
  readonly noExports: string;
  readonly tableHeaders: readonly [name: string, kind: string, description: string, source: string];
  readonly signaturesHeading: string;
  readonly noCallableSignatures: string;
  readonly noSummary: string;
  readonly kindLabels: Readonly<Record<string, string>>;
};

const localeStrings: Record<LocaleCode, LocaleStrings> = {
  en: {
    code: "en",
    routePrefix: "/en/docs",
    indexTitle: "API Reference",
    indexDescription: "Auto-generated SDK API reference organized by entry point",
    indexHeading: "API Reference",
    indexIntro: "This section is generated from SDK TypeScript sources using TypeDoc.",
    generatedAtLabel: "Generated at",
    entryPointsHeading: "Entry Points",
    moduleFrontmatterTitle: (pageTitle) => `API - ${pageTitle}`,
    moduleFrontmatterDescription: (importPath) => `Auto-generated API reference for ${importPath}`,
    moduleHeading: (pageTitle) => `API - ${pageTitle}`,
    importPathLabel: "Import path",
    generatedFromTypedoc: "Generated from TypeDoc.",
    noExports: "No exported symbols found.",
    tableHeaders: ["Name", "Kind", "Description", "Source"],
    signaturesHeading: "Signatures",
    noCallableSignatures: "No callable signatures in this entry point.",
    noSummary: "No summary available.",
    kindLabels: {
      Enum: "Enum",
      Variable: "Variable",
      Function: "Function",
      Class: "Class",
      Interface: "Interface",
      Method: "Method",
      "Type Alias": "Type Alias",
      Symbol: "Symbol",
    },
  },
  es: {
    code: "es",
    routePrefix: "/es/docs",
    indexTitle: "Referencia de API",
    indexDescription:
      "Referencia de API de SDK generada automáticamente y organizada por punto de entrada",
    indexHeading: "Referencia de API",
    indexIntro: "Esta sección se genera a partir de fuentes de SDK TypeScript utilizando TypeDoc.",
    generatedAtLabel: "Generado en",
    entryPointsHeading: "Puntos de entrada",
    moduleFrontmatterTitle: (pageTitle) => `API - ${pageTitle}`,
    moduleFrontmatterDescription: (importPath) =>
      `Referencia de API generada automáticamente para ${importPath}`,
    moduleHeading: (pageTitle) => `API - ${pageTitle}`,
    importPathLabel: "Ruta de importación",
    generatedFromTypedoc: "Generado a partir de TypeDoc.",
    noExports: "No se encontraron símbolos exportados.",
    tableHeaders: ["Nombre", "Tipo", "Descripción", "Fuente"],
    signaturesHeading: "Firmas",
    noCallableSignatures: "No hay firmas invocables en este punto de entrada.",
    noSummary: "No hay resumen disponible.",
    kindLabels: {
      Enum: "Enumeración",
      Variable: "Variable",
      Function: "Función",
      Class: "Clase",
      Interface: "Interfaz",
      Method: "Método",
      "Type Alias": "Alias de tipo",
      Symbol: "Símbolo",
    },
  },
};

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

function flattenSummary(comment: CommentShape | undefined, noSummaryText: string): string {
  if (!comment?.summary || comment.summary.length === 0) {
    return noSummaryText;
  }

  const text = comment.summary
    .map((part) => (part.kind === "text" ? (part.text ?? "") : ""))
    .join("")
    .replaceAll("\n", " ")
    .trim();

  return text.length > 0 ? text : noSummaryText;
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

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function sourceRef(source?: SourceShape): string {
  const fileName = source?.fileName;
  const line = source?.line;
  if (!fileName || !line) {
    return "-";
  }
  return `\`${fileName}:${line}\``;
}

function parseMarkdownTableRow(line: string): string[] | undefined {
  if (!line.startsWith("|")) {
    return undefined;
  }

  const trimmed = line.trim();
  const rawCells = trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
  if (rawCells.length < 4) {
    return undefined;
  }

  return rawCells.map((cell) => cell.replaceAll("\\|", "|"));
}

function readTranslatedSummariesForModulePage(filePath: string): Map<string, string> {
  if (!existsSync(filePath)) {
    return new Map();
  }

  const lines = readFileSync(filePath, "utf8").split("\n");
  const translations = new Map<string, string>();

  for (const line of lines) {
    const cells = parseMarkdownTableRow(line);
    if (!cells) {
      continue;
    }

    const nameCell = cells[0];
    const descriptionCell = cells[2];
    if (!nameCell.startsWith("`") || !nameCell.endsWith("`")) {
      continue;
    }
    if (nameCell.includes("---")) {
      continue;
    }

    const symbolName = nameCell.slice(1, -1);
    if (symbolName.length === 0) {
      continue;
    }
    translations.set(symbolName, descriptionCell);
  }

  return translations;
}

function alternateSymbolNames(symbolName: string): string[] {
  const aliases = new Set<string>([symbolName]);

  if (symbolName.endsWith("Api")) {
    aliases.add(`${symbolName.slice(0, -3)}API`);
  }
  if (symbolName.endsWith("API")) {
    aliases.add(`${symbolName.slice(0, -3)}Api`);
  }

  return [...aliases];
}

function getTranslatedSummary(
  translations: ReadonlyMap<string, string> | undefined,
  symbolName: string | undefined,
): string | undefined {
  if (!translations || !symbolName) {
    return undefined;
  }

  for (const candidate of alternateSymbolNames(symbolName)) {
    const exact = translations.get(candidate);
    if (exact?.trim()) {
      return exact.trim();
    }
  }

  const normalizedTarget = symbolName.toLowerCase();
  for (const [candidate, text] of translations.entries()) {
    if (candidate.toLowerCase() === normalizedTarget && text.trim()) {
      return text.trim();
    }
  }

  return undefined;
}

function localizeKind(kind: string, locale: LocaleStrings): string {
  return locale.kindLabels[kind] ?? kind;
}

function renderModuleSection(
  moduleName: string,
  symbols: ReflectionShape[],
  locale: LocaleStrings,
  translatedSummaries?: ReadonlyMap<string, string>,
): string {
  const lines: string[] = [];
  lines.push(`## \`${moduleName}\``);
  lines.push("");

  if (symbols.length === 0) {
    lines.push(locale.noExports);
    lines.push("");
    return lines.join("\n");
  }

  const [nameHeader, kindHeader, descriptionHeader, sourceHeader] = locale.tableHeaders;
  lines.push(`| ${nameHeader} | ${kindHeader} | ${descriptionHeader} | ${sourceHeader} |`);
  lines.push("| ---- | ---- | ----------- | ------ |");

  for (const symbol of symbols) {
    const name = escapeTableCell(`\`${symbol.name ?? "unknown"}\``);
    const kind = localizeKind(reflectionKind(symbol.kind), locale);
    const defaultSummary = flattenSummary(symbol.comment, locale.noSummary);
    const summary = escapeTableCell(
      getTranslatedSummary(translatedSummaries, symbol.name) ?? defaultSummary,
    );
    const source = sourceRef(symbol.sources?.[0]);
    lines.push(`| ${name} | ${kind} | ${summary} | ${source} |`);
  }

  lines.push("");
  lines.push(`### ${locale.signaturesHeading}`);
  lines.push("");

  const signatures = symbols
    .map((symbol) => formatSignature(symbol))
    .filter((signature): signature is string => Boolean(signature));

  if (signatures.length === 0) {
    lines.push(locale.noCallableSignatures);
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

function renderModulePage({
  pageTitle,
  importPath,
  generatedAt,
  symbols,
  locale,
  translatedSummaries,
}: {
  readonly pageTitle: string;
  readonly importPath: string;
  readonly generatedAt: string;
  readonly symbols: ReflectionShape[];
  readonly locale: LocaleStrings;
  readonly translatedSummaries?: ReadonlyMap<string, string>;
}): string {
  const lines: string[] = [
    "---",
    `title: ${yamlString(locale.moduleFrontmatterTitle(pageTitle))}`,
    `description: ${yamlString(locale.moduleFrontmatterDescription(importPath))}`,
    "---",
    "",
    `# ${locale.moduleHeading(pageTitle)}`,
    "",
    `${locale.importPathLabel}: \`${importPath}\``,
    "",
    locale.generatedFromTypedoc,
    "",
    `${locale.generatedAtLabel}: \`${generatedAt}\``,
    "",
    renderModuleSection(importPath, symbols, locale, translatedSummaries),
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
  locale: LocaleStrings,
): string {
  const lines: string[] = [
    "---",
    `title: ${yamlString(locale.indexTitle)}`,
    `description: ${yamlString(locale.indexDescription)}`,
    "---",
    "",
    `# ${locale.indexHeading}`,
    "",
    locale.indexIntro,
    "",
    `${locale.generatedAtLabel}: \`${generatedAt}\``,
    "",
    `## ${locale.entryPointsHeading}`,
    "",
  ];

  for (const module of modules) {
    lines.push(
      `- [${module.pageTitle}](${locale.routePrefix}/sdk/api/${module.slug}) - \`${module.importPath}\``,
    );
  }

  lines.push("");
  return String(lines.join("\n").trimEnd());
}

function renderApiMeta(
  modules: readonly { readonly slug: string }[],
  locale: LocaleStrings,
): string {
  const pages = ["index", ...modules.map((module) => module.slug)];
  const meta = {
    title: locale.indexTitle,
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
  const enApiDir = resolve(docsDir, "content/docs/en/sdk/api");
  const esApiDir = resolve(docsDir, "content/docs/es/sdk/api");
  const legacyApiReferencePath = resolve(docsDir, "content/docs/sdk/api-reference.mdx");

  mkdirSync(dirname(typedocJsonPath), { recursive: true });
  mkdirSync(enApiDir, { recursive: true });
  mkdirSync(esApiDir, { recursive: true });

  const typedocArgs = [
    "--json",
    typedocJsonPath,
    "--entryPoints",
    resolve(repoRoot, "sdk/src/index.ts"),
    resolve(repoRoot, "sdk/src/operations/index.ts"),
    resolve(repoRoot, "sdk/src/services/index.ts"),
    resolve(repoRoot, "sdk/src/lib/index.ts"),
    resolve(repoRoot, "types/src/index.ts"),
    resolve(repoRoot, "sdk/src/credentials/index.ts"),
    "--tsconfig",
    resolve(repoRoot, "tsconfig.json"),
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

  const existingSpanishSummariesBySlug = new Map<string, Map<string, string>>();
  for (const module of modules) {
    existingSpanishSummariesBySlug.set(
      module.slug,
      readTranslatedSummariesForModulePage(resolve(esApiDir, `${module.slug}.mdx`)),
    );
  }

  for (const localeTarget of [
    { code: "en" as const, apiDir: enApiDir },
    { code: "es" as const, apiDir: esApiDir },
  ]) {
    const locale = localeStrings[localeTarget.code];

    const localizedModules = modules.map((module) => ({
      ...module,
      pageTitle: module.pageTitles[locale.code],
    }));

    const indexContent = renderApiIndexPage(generatedAt, localizedModules, locale);
    const metaContent = renderApiMeta(localizedModules, locale);

    writeFileSync(resolve(localeTarget.apiDir, "index.mdx"), indexContent, "utf8");
    writeFileSync(resolve(localeTarget.apiDir, "meta.json"), metaContent, "utf8");

    for (const module of localizedModules) {
      const translatedSummaries =
        locale.code === "es" ? existingSpanishSummariesBySlug.get(module.slug) : undefined;
      const content = renderModulePage({
        pageTitle: module.pageTitle,
        importPath: module.importPath,
        generatedAt,
        symbols: module.symbols,
        locale,
        translatedSummaries,
      });
      writeFileSync(resolve(localeTarget.apiDir, `${module.slug}.mdx`), content, "utf8");
    }
  }

  rmSync(legacyApiReferencePath, { force: true });
  console.log(`Generated API docs in ${enApiDir} and ${esApiDir}`);
}

main();
