import type { Node, Root } from "fumadocs-core/page-tree";
import {
  BookOpen,
  Boxes,
  Braces,
  Bug,
  CircleHelp,
  Compass,
  Database,
  FileCode2,
  FileTerminal,
  FlaskConical,
  HardDrive,
  KeyRound,
  Layers3,
  Network,
  Rocket,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Terminal,
  Wrench,
  Zap,
} from "lucide-react";
import { createElement, type ReactNode } from "react";

import { localizePath, stripLocalePrefix, type Locale } from "@/lib/i18n";

const TRANSLATIONS_ES = new Map<string, string>([
  ["Documentation", "Documentación"],
  ["CLI", "CLI"],
  ["Command-line instructions", "Guía de línea de comandos"],
  ["Getting Started", "Primeros pasos"],
  ["Installation", "Instalación"],
  ["Build CLI Binary", "Compilar desde código fuente"],
  ["Configuration", "Configuración"],
  ["Guides", "Guías"],
  ["Choose Command", "Elegir comando"],
  ["Scan Profiles", "Perfiles de escaneo"],
  ["Exit Codes", "Códigos de salida"],
  ["Troubleshooting", "Solución de problemas"],
  ["Commands", "Comandos"],
  ["Overview", "Resumen"],
  ["SDK", "SDK"],
  ["Build on top of the SDK", "Construye sobre el SDK"],
  ["Error Model", "Modelo de errores"],
  ["Layers and Runtime", "Capas y runtime"],
  ["Operations", "Operaciones"],
  ["Examples", "Ejemplos"],
  ["Services: Compute & Storage", "Servicios: Cómputo y almacenamiento"],
  ["Services: Data & Networking", "Servicios: Datos y redes"],
  ["Services: Security & Platform", "Servicios: Seguridad y plataforma"],
  ["Utilities", "Utilidades"],
  ["Reference Map", "Mapa de referencia"],
  ["API", "API"],
  ["Core", "Core"],
  ["Services", "Servicios"],
  ["Types", "Tipos"],
  ["Credentials", "Credenciales"],
]);

const baseDocsTree: Root = {
  name: "Documentation",
  children: [
    {
      type: "folder",
      name: "CLI",
      description: "Command-line instructions",
      root: true,
      index: {
        type: "page",
        name: "Getting Started",
        url: "/docs/cli",
      },
      children: [
        {
          type: "page",
          name: "Installation",
          url: "/docs/cli/installation",
        },
        {
          type: "page",
          name: "Build CLI Binary",
          url: "/docs/cli/build-cli",
        },
        {
          type: "page",
          name: "Configuration",
          url: "/docs/cli/configuration",
        },
        {
          type: "separator",
          name: "Guides",
        },
        {
          type: "page",
          name: "Choose Command",
          url: "/docs/cli/choose-command",
        },
        {
          type: "page",
          name: "Scan Profiles",
          url: "/docs/cli/scan-profiles",
        },
        {
          type: "page",
          name: "Exit Codes",
          url: "/docs/cli/exit-codes",
        },
        {
          type: "page",
          name: "Troubleshooting",
          url: "/docs/cli/troubleshooting",
        },
        {
          type: "separator",
          name: "Commands",
        },
        {
          type: "page",
          name: "Overview",
          url: "/docs/cli/commands",
        },
        {
          type: "page",
          name: "init",
          url: "/docs/cli/commands/init",
        },
        {
          type: "page",
          name: "describe",
          url: "/docs/cli/commands/describe",
        },
        {
          type: "page",
          name: "query",
          url: "/docs/cli/commands/query",
        },
        {
          type: "page",
          name: "use-letme",
          url: "/docs/cli/commands/use-letme",
        },
        {
          type: "page",
          name: "config",
          url: "/docs/cli/commands/config",
        },
      ],
    },
    {
      type: "folder",
      name: "SDK",
      description: "Build on top of the SDK",
      root: true,
      index: {
        type: "page",
        name: "Overview",
        url: "/docs/sdk",
      },
      children: [
        {
          type: "page",
          name: "Getting Started",
          url: "/docs/sdk/getting-started",
        },
        {
          type: "page",
          name: "Error Model",
          url: "/docs/sdk/error-model",
        },
        {
          type: "page",
          name: "Layers and Runtime",
          url: "/docs/sdk/layers-and-runtime",
        },
        {
          type: "page",
          name: "Operations",
          url: "/docs/sdk/operations",
        },
        {
          type: "page",
          name: "Examples",
          url: "/docs/sdk/examples",
        },
        {
          type: "page",
          name: "Services: Compute & Storage",
          url: "/docs/sdk/services-compute-storage",
        },
        {
          type: "page",
          name: "Services: Data & Networking",
          url: "/docs/sdk/services-data-networking",
        },
        {
          type: "page",
          name: "Services: Security & Platform",
          url: "/docs/sdk/services-security-platform",
        },
        {
          type: "page",
          name: "Utilities",
          url: "/docs/sdk/utilities",
        },
        {
          type: "page",
          name: "Reference Map",
          url: "/docs/sdk/reference-map",
        },
        {
          type: "separator",
          name: "API",
        },
        {
          type: "page",
          name: "Overview",
          url: "/docs/sdk/api",
        },
        {
          type: "page",
          name: "Core",
          url: "/docs/sdk/api/core",
        },
        {
          type: "page",
          name: "Operations",
          url: "/docs/sdk/api/operations",
        },
        {
          type: "page",
          name: "Services",
          url: "/docs/sdk/api/services",
        },
        {
          type: "page",
          name: "Utilities",
          url: "/docs/sdk/api/lib",
        },
        {
          type: "page",
          name: "Types",
          url: "/docs/sdk/api/types",
        },
        {
          type: "page",
          name: "Credentials",
          url: "/docs/sdk/api/credentials",
        },
      ],
    },
  ],
};

const localizeString = (value: string, locale: Locale): string => {
  if (locale !== "es") {
    return value;
  }

  return TRANSLATIONS_ES.get(value) ?? value;
};

function localizeTreeValue(value: Root, locale: Locale): Root;
function localizeTreeValue(value: unknown, locale: Locale): unknown;
function localizeTreeValue(value: unknown, locale: Locale): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => localizeTreeValue(item, locale));
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "url" && typeof child === "string") {
        result[key] = localizePath(child, locale);
        continue;
      }

      if ((key === "name" || key === "description") && typeof child === "string") {
        result[key] = localizeString(child, locale);
        continue;
      }

      result[key] = localizeTreeValue(child, locale);
    }
    return result;
  }

  return value;
}

const normalizeTreeUrl = (url: string): string => stripLocalePrefix(url).path;

const makeIcon = (Icon: typeof Terminal): ReactNode => createElement(Icon, { size: 16 });

const sidebarIconsByPath: Record<string, () => ReactNode> = {
  "/docs/cli": () => makeIcon(Terminal),
  "/docs/cli/installation": () => makeIcon(BookOpen),
  "/docs/cli/build-cli": () => makeIcon(Wrench),
  "/docs/cli/configuration": () => makeIcon(Settings),
  "/docs/cli/choose-command": () => makeIcon(Compass),
  "/docs/cli/scan-profiles": () => makeIcon(Search),
  "/docs/cli/exit-codes": () => makeIcon(Bug),
  "/docs/cli/troubleshooting": () => makeIcon(CircleHelp),
  "/docs/cli/commands": () => makeIcon(FileTerminal),
  "/docs/cli/commands/init": () => makeIcon(Zap),
  "/docs/cli/commands/describe": () => makeIcon(FileCode2),
  "/docs/cli/commands/query": () => makeIcon(Search),
  "/docs/cli/commands/use-letme": () => makeIcon(Shield),
  "/docs/cli/commands/config": () => makeIcon(Settings),
  "/docs/sdk": () => makeIcon(Braces),
  "/docs/sdk/getting-started": () => makeIcon(Rocket),
  "/docs/sdk/error-model": () => makeIcon(ShieldAlert),
  "/docs/sdk/layers-and-runtime": () => makeIcon(Layers3),
  "/docs/sdk/operations": () => makeIcon(Boxes),
  "/docs/sdk/examples": () => makeIcon(FlaskConical),
  "/docs/sdk/services-compute-storage": () => makeIcon(HardDrive),
  "/docs/sdk/services-data-networking": () => makeIcon(Network),
  "/docs/sdk/services-security-platform": () => makeIcon(Shield),
  "/docs/sdk/utilities": () => makeIcon(Wrench),
  "/docs/sdk/reference-map": () => makeIcon(Compass),
  "/docs/sdk/api": () => makeIcon(Database),
  "/docs/sdk/api/core": () => makeIcon(Layers3),
  "/docs/sdk/api/operations": () => makeIcon(Boxes),
  "/docs/sdk/api/services": () => makeIcon(Network),
  "/docs/sdk/api/lib": () => makeIcon(Wrench),
  "/docs/sdk/api/types": () => makeIcon(Braces),
  "/docs/sdk/api/credentials": () => makeIcon(KeyRound),
};

const iconForPath = (url: string | undefined): ReactNode | undefined => {
  if (!url) {
    return undefined;
  }
  return sidebarIconsByPath[normalizeTreeUrl(url)]?.();
};

function decorateNodeWithIcon(node: Node): Node {
  if (node.type === "page") {
    return {
      ...node,
      icon: iconForPath(node.url) ?? node.icon,
    };
  }

  if (node.type === "folder") {
    const folderIcon = iconForPath(node.index?.url);

    return {
      ...node,
      icon: folderIcon ?? node.icon,
      index: node.index
        ? ({
            ...node.index,
            icon: iconForPath(node.index.url) ?? node.index.icon,
          } as typeof node.index)
        : node.index,
      children: node.children.map(decorateNodeWithIcon),
    };
  }

  return node;
}

const decorateTreeWithIcons = (tree: Root): Root => ({
  ...tree,
  children: tree.children.map(decorateNodeWithIcon),
});

export const getDocsTree = (locale: Locale): Root =>
  decorateTreeWithIcons(localizeTreeValue(baseDocsTree, locale));

export const docsTree: Root = getDocsTree("en");
