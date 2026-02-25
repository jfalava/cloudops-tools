import { createFileRoute, notFound } from "@tanstack/react-router";
import type { TOCItemType } from "fumadocs-core/toc";
import * as BaseTabs from "fumadocs-ui/components/tabs.unstyled";
import { I18nProvider } from "fumadocs-ui/contexts/i18n";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsPage, DocsBody } from "fumadocs-ui/page";
import { useEffect, useState, type ComponentProps } from "react";

import { CopyMarkdownButton } from "@/components/copy-markdown-button";
import { ErrorBoundary } from "@/components/error-boundary";
import { getDocsTree } from "@/lib/docs-tree";
import { baseOptions } from "@/lib/layout.shared";
import {
  buildCanonicalLink,
  buildSeoMeta,
  defaultDocsDescription,
  defaultDocsDescriptionEs,
  seoTitle,
} from "@/lib/seo";

const englishDocModules: Record<string, () => Promise<typeof import("*.mdx")>> = {
  "": () => import("../../content/docs/en/index.mdx"),
  index: () => import("../../content/docs/en/index.mdx"),
  cli: () => import("../../content/docs/en/cli/index.mdx"),
  "cli/index": () => import("../../content/docs/en/cli/index.mdx"),
  "cli/installation": () => import("../../content/docs/en/cli/installation.mdx"),
  "cli/build-cli": () => import("../../content/docs/en/cli/build-cli.mdx"),
  "cli/configuration": () => import("../../content/docs/en/cli/configuration.mdx"),
  "cli/choose-command": () => import("../../content/docs/en/cli/choose-command.mdx"),
  "cli/scan-profiles": () => import("../../content/docs/en/cli/scan-profiles.mdx"),
  "cli/exit-codes": () => import("../../content/docs/en/cli/exit-codes.mdx"),
  "cli/troubleshooting": () => import("../../content/docs/en/cli/troubleshooting.mdx"),
  "cli/commands": () => import("../../content/docs/en/cli/commands/index.mdx"),
  "cli/commands/index": () => import("../../content/docs/en/cli/commands/index.mdx"),
  "cli/commands/init": () => import("../../content/docs/en/cli/commands/init.mdx"),
  "cli/commands/describe": () => import("../../content/docs/en/cli/commands/describe.mdx"),
  "cli/commands/query": () => import("../../content/docs/en/cli/commands/query.mdx"),
  "cli/commands/use-letme": () => import("../../content/docs/en/cli/commands/use-letme.mdx"),
  "cli/commands/config": () => import("../../content/docs/en/cli/commands/config.mdx"),
  sdk: () => import("../../content/docs/en/sdk/index.mdx"),
  "sdk/index": () => import("../../content/docs/en/sdk/index.mdx"),
  "sdk/getting-started": () => import("../../content/docs/en/sdk/getting-started.mdx"),
  "sdk/error-model": () => import("../../content/docs/en/sdk/error-model.mdx"),
  "sdk/layers-and-runtime": () => import("../../content/docs/en/sdk/layers-and-runtime.mdx"),
  "sdk/operations": () => import("../../content/docs/en/sdk/operations.mdx"),
  "sdk/examples": () => import("../../content/docs/en/sdk/examples.mdx"),
  "sdk/services-compute-storage": () =>
    import("../../content/docs/en/sdk/services-compute-storage.mdx"),
  "sdk/services-data-networking": () =>
    import("../../content/docs/en/sdk/services-data-networking.mdx"),
  "sdk/services-security-platform": () =>
    import("../../content/docs/en/sdk/services-security-platform.mdx"),
  "sdk/utilities": () => import("../../content/docs/en/sdk/utilities.mdx"),
  "sdk/reference-map": () => import("../../content/docs/en/sdk/reference-map.mdx"),
  "sdk/api": () => import("../../content/docs/en/sdk/api/index.mdx"),
  "sdk/api/index": () => import("../../content/docs/en/sdk/api/index.mdx"),
  "sdk/api/core": () => import("../../content/docs/en/sdk/api/core.mdx"),
  "sdk/api/operations": () => import("../../content/docs/en/sdk/api/operations.mdx"),
  "sdk/api/services": () => import("../../content/docs/en/sdk/api/services.mdx"),
  "sdk/api/lib": () => import("../../content/docs/en/sdk/api/lib.mdx"),
  "sdk/api/types": () => import("../../content/docs/en/sdk/api/types.mdx"),
  "sdk/api/credentials": () => import("../../content/docs/en/sdk/api/credentials.mdx"),
};

const rawSpanishDocModuleLoaders = import.meta.glob<typeof import("*.mdx")>(
  "../../content/docs/es/**/*.{mdx,md}",
);

const rawEnglishDocSources = import.meta.glob("../../content/docs/en/**/*.{mdx,md}", {
  query: "?raw",
  import: "default",
  eager: true,
});

const rawSpanishDocSources = import.meta.glob("../../content/docs/es/**/*.{mdx,md}", {
  query: "?raw",
  import: "default",
  eager: true,
});

type DocFrontmatter = {
  title?: string;
  description?: string;
};

type TocItem = TOCItemType;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isTocItem = (value: unknown): value is TocItem =>
  isRecord(value) &&
  "title" in value &&
  typeof value.url === "string" &&
  typeof value.depth === "number";

const readToc = (value: unknown): TocItem[] | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const toc = value["toc"];
  if (!Array.isArray(toc) || !toc.every(isTocItem)) {
    return undefined;
  }

  return toc;
};

const readRawDocSource = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }

  if (
    value !== null &&
    typeof value === "object" &&
    "default" in value &&
    typeof value.default === "string"
  ) {
    return value.default;
  }

  return null;
};

const parseFrontmatter = (source: string): DocFrontmatter => {
  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) {
    return {};
  }

  const lines = source.split(/\r?\n/);
  if (lines[0] !== "---") {
    return {};
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  if (endIndex <= 0) {
    return {};
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const entries = frontmatterLines
    .map((line) => line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => match !== null);

  const frontmatter: DocFrontmatter = {};
  for (const match of entries) {
    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^['"]|['"]$/g, "");
    if (key === "title") {
      frontmatter.title = value;
    } else if (key === "description") {
      frontmatter.description = value;
    }
  }

  return frontmatter;
};

type MdxTabsProps = ComponentProps<typeof BaseTabs.Tabs> & {
  items: string[];
};

type TabSvgDef = {
  d: string;
  viewBox: string;
};

const tabIconByLabel: Record<string, TabSvgDef> = {
  npm: {
    viewBox: "0 0 24 24",
    d: "M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019l-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z",
  },
  pnpm: {
    viewBox: "0 0 24 24",
    d: "M0 0v7.5h7.5V0zm8.25 0v7.5h7.498V0zm8.25 0v7.5H24V0zM2 2h3.5v3.5H2zm8.25 0h3.498v3.5H10.25zm8.25 0H22v3.5h-3.5zM8.25 8.25v7.5h7.498v-7.5zm8.25 0v7.5H24v-7.5zm2 2H22v3.5h-3.5zM0 16.5V24h7.5v-7.5zm8.25 0V24h7.498v-7.5zm8.25 0V24H24v-7.5z",
  },
  Yarn: {
    viewBox: "0 0 24 24",
    d: "M12 0C5.375 0 0 5.375 0 12s5.375 12 12 12s12-5.375 12-12S18.625 0 12 0m.768 4.105c.183 0 .363.053.525.157c.125.083.287.185.755 1.154c.31-.088.468-.042.551-.019c.204.056.366.19.463.375c.477.917.542 2.553.334 3.605c-.241 1.232-.755 2.029-1.131 2.576c.324.329.778.899 1.117 1.825c.278.774.31 1.478.273 2.015a6 6 0 0 0 .602-.329c.593-.366 1.487-.917 2.553-.931c.714-.009 1.269.445 1.353 1.103a1.23 1.23 0 0 1-.945 1.362c-.649.158-.95.278-1.821.843c-1.232.797-2.539 1.242-3.012 1.39a1.7 1.7 0 0 1-.704.343c-.737.181-3.266.315-3.466.315h-.046c-.783 0-1.214-.241-1.45-.491c-.658.329-1.51.19-2.122-.134a1.08 1.08 0 0 1-.58-1.153a1.2 1.2 0 0 1-.153-.195c-.162-.25-.528-.936-.454-1.946c.056-.723.556-1.367.88-1.71a5.5 5.5 0 0 1 .408-2.256c.306-.727.885-1.348 1.32-1.737c-.32-.537-.644-1.367-.329-2.21c.227-.602.412-.936.82-1.08h-.005c.199-.074.389-.153.486-.259a3.42 3.42 0 0 1 2.298-1.103q.056-.138.125-.283c.31-.658.639-1.029 1.024-1.168a1 1 0 0 1 .328-.06zm.006.7c-.507.016-1.001 1.519-1.001 1.519s-1.27-.204-2.266.871c-.199.218-.468.334-.746.44c-.079.028-.176.023-.417.672c-.371.991.625 2.094.625 2.094s-1.186.839-1.626 1.881c-.486 1.144-.338 2.261-.338 2.261s-.843.732-.899 1.487c-.051.663.139 1.2.343 1.515c.227.343.51.176.51.176s-.561.653-.037.931c.477.25 1.283.394 1.71-.037c.31-.31.371-1.001.486-1.283c.028-.065.12.111.209.199c.097.093.264.195.264.195s-.755.324-.445 1.066c.102.246.468.403 1.066.398c.222-.005 2.664-.139 3.313-.296c.375-.088.505-.283.505-.283s1.566-.431 2.998-1.357c.917-.598 1.293-.76 2.034-.936c.612-.148.57-1.098-.241-1.084c-.839.009-1.575.44-2.196.825c-1.163.718-1.742.672-1.742.672l-.018-.032c-.079-.13.371-1.293-.134-2.678c-.547-1.515-1.413-1.881-1.344-1.997c.297-.5 1.038-1.297 1.334-2.78c.176-.899.13-2.377-.269-3.151c-.074-.144-.732.241-.732.241s-.616-1.371-.788-1.483a.27.27 0 0 0-.157-.046z",
  },
  Bun: {
    viewBox: "0 0 24 24",
    d: "M12 22.596c6.628 0 12-4.338 12-9.688c0-3.318-2.057-6.248-5.219-7.986c-1.286-.715-2.297-1.357-3.139-1.89C14.058 2.025 13.08 1.404 12 1.404c-1.097 0-2.334.785-3.966 1.821a50 50 0 0 1-2.816 1.697C2.057 6.66 0 9.59 0 12.908c0 5.35 5.372 9.687 12 9.687zM10.599 4.715c.334-.759.503-1.58.498-2.409c0-.145.202-.187.23-.029c.658 2.783-.902 4.162-2.057 4.624c-.124.048-.199-.121-.103-.209a5.8 5.8 0 0 0 1.432-1.977m2.058-.102a5.8 5.8 0 0 0-.782-2.306v-.016c-.069-.123.086-.263.185-.172c1.962 2.111 1.307 4.067.556 5.051c-.082.103-.23-.003-.189-.126a5.85 5.85 0 0 0 .23-2.431m1.776-.561a5.7 5.7 0 0 0-1.612-1.806v-.014c-.112-.085-.024-.274.114-.218c2.595 1.087 2.774 3.18 2.459 4.407a.12.12 0 0 1-.049.071a.11.11 0 0 1-.153-.026a.12.12 0 0 1-.022-.083a5.9 5.9 0 0 0-.737-2.331m-5.087.561c-.617.546-1.282.76-2.063 1c-.117 0-.195-.078-.156-.181c1.752-.909 2.376-1.649 2.999-2.778c0 0 .155-.118.188.085c0 .304-.349 1.329-.968 1.874m4.945 11.237a2.96 2.96 0 0 1-.937 1.553c-.346.346-.8.565-1.286.62a2.18 2.18 0 0 1-1.327-.62a2.96 2.96 0 0 1-.925-1.553a.24.24 0 0 1 .064-.198a.23.23 0 0 1 .193-.069h3.965a.23.23 0 0 1 .19.07c.05.053.073.125.063.197m-5.458-2.176a1.86 1.86 0 0 1-2.384-.245a1.98 1.98 0 0 1-.233-2.447c.207-.319.503-.566.848-.713a1.84 1.84 0 0 1 1.092-.11c.366.075.703.261.967.531a1.98 1.98 0 0 1 .408 2.114a1.93 1.93 0 0 1-.698.869zm8.495.005a1.86 1.86 0 0 1-2.381-.253a1.96 1.96 0 0 1-.547-1.366c0-.384.11-.76.32-1.079c.207-.319.503-.567.849-.713a1.84 1.84 0 0 1 1.093-.108c.367.076.704.262.968.534a1.98 1.98 0 0 1 .4 2.117a1.93 1.93 0 0 1-.702.868",
  },
  "macOS arm64": {
    viewBox: "0 0 24 24",
    d: "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47c-1.34.03-1.77-.79-3.29-.79c-1.53 0-2 .77-3.27.82c-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51c1.28-.02 2.5.87 3.29.87c.78 0 2.26-1.07 3.81-.91c.65.03 2.47.26 3.64 1.98c-.09.06-2.17 1.28-2.15 3.81c.03 3.02 2.65 4.03 2.68 4.04c-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5c.13 1.17-.34 2.35-1.04 3.19c-.69.85-1.83 1.51-2.95 1.42c-.15-1.15.41-2.35 1.05-3.11",
  },
  "Linux x64": {
    viewBox: "0 0 24 24",
    d: "M12.504 0q-.232 0-.48.021c-4.226.333-3.105 4.807-3.17 6.298c-.076 1.092-.3 1.953-1.05 3.02c-.885 1.051-2.127 2.75-2.716 4.521c-.278.832-.41 1.684-.287 2.489a.4.4 0 0 0-.11.135c-.26.268-.45.6-.663.839c-.199.199-.485.267-.797.4c-.313.136-.658.269-.864.68c-.09.189-.136.394-.132.602c0 .199.027.4.055.536c.058.399.116.728.04.97c-.249.68-.28 1.145-.106 1.484c.174.334.535.47.94.601c.81.2 1.91.135 2.774.6c.926.466 1.866.67 2.616.47c.526-.116.97-.464 1.208-.946c.587-.003 1.23-.269 2.26-.334c.699-.058 1.574.267 2.577.2c.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071s1.592-.536 2.257-1.306c.631-.765 1.683-1.084 2.378-1.503c.348-.199.629-.469.649-.853c.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926c-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.36.36 0 0 0-.19-.064c.431-1.278.264-2.55-.173-3.694c-.533-1.41-1.465-2.638-2.175-3.483c-.796-1.005-1.576-1.957-1.56-3.368c.026-2.152.236-6.133-3.544-6.139m.529 3.405h.013c.213 0 .396.062.584.198c.19.135.33.332.438.533c.105.259.158.459.166.724c0-.02.006-.04.006-.06v.105l-.004-.021l-.004-.024a1.8 1.8 0 0 1-.15.706a.95.95 0 0 1-.213.335a1 1 0 0 0-.088-.042c-.104-.045-.198-.064-.284-.133a1.3 1.3 0 0 0-.22-.066c.05-.06.146-.133.183-.198q.08-.193.088-.402v-.02a1.2 1.2 0 0 0-.061-.4c-.045-.134-.101-.2-.183-.333c-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 0 0-.205.334a1.2 1.2 0 0 0-.09.4v.019q.002.134.02.267c-.193-.067-.438-.135-.607-.202a2 2 0 0 1-.018-.2v-.02a1.8 1.8 0 0 1 .15-.768a1.08 1.08 0 0 1 .43-.533a1 1 0 0 1 .594-.2zm-2.962.059h.036c.142 0 .27.048.399.135c.146.129.264.288.344.465c.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024c-.152.055-.274.135-.393.2q.018-.136.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.6.6 0 0 0-.166-.267a.25.25 0 0 0-.183-.064h-.021c-.071.006-.13.04-.186.132a.55.55 0 0 0-.12.27a1 1 0 0 0-.023.33v.015c.012.135.037.2.08.334c.046.134.098.2.166.268q.014.014.034.024c-.07.057-.117.07-.176.136a.3.3 0 0 1-.131.068a2.6 2.6 0 0 1-.275-.402a1.8 1.8 0 0 1-.155-.667a1.8 1.8 0 0 1 .08-.668a1.4 1.4 0 0 1 .283-.535c.128-.133.26-.2.418-.2m1.37 1.706c.332 0 .733.065 1.216.399c.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.57.57 0 0 1 .016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465c-.276.135-.588.292-1.012.267a1.1 1.1 0 0 1-.448-.067a4 4 0 0 1-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71q-.104-.403.193-.6c.224-.135.38-.271.483-.336c.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601c.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473c.286.534.855 1.659 1.102 3.024c.156-.005.33.018.513.064c.646-1.671-.546-3.467-1.089-3.966c-.22-.2-.232-.335-.123-.335c.59.534 1.365 1.572 1.646 2.757c.13.535.16 1.104.021 1.67c.067.028.135.06.205.067c1.032.534 1.413.938 1.23 1.537v-.043c-.06-.003-.12 0-.18 0h-.016c.151-.467-.182-.825-1.065-1.224c-.915-.4-1.646-.336-1.77.465c-.008.043-.013.066-.018.135c-.068.023-.139.053-.209.064c-.43.268-.662.669-.793 1.187c-.13.533-.17 1.156-.205 1.869v.003c-.02.334-.17.838-.319 1.35c-1.5 1.072-3.58 1.538-5.348.334a2.7 2.7 0 0 0-.402-.533a1.5 1.5 0 0 0-.275-.333c.182 0 .338-.03.465-.067a.62.62 0 0 0 .314-.334c.108-.267 0-.697-.345-1.163s-.931-.995-1.788-1.521c-.63-.4-.986-.87-1.15-1.396c-.165-.534-.143-1.085-.015-1.645c.245-1.07.873-2.11 1.274-2.763c.107-.065.037.135-.408.974c-.396.751-1.14 2.497-.122 3.854a8.1 8.1 0 0 1 .647-2.876c.564-1.278 1.743-3.504 1.836-5.268c.048.036.217.135.289.202c.218.133.38.333.59.465c.21.201.477.335.876.335q.058.005.11.006c.412 0 .73-.134.997-.268c.29-.134.52-.334.74-.4h.005c.467-.135.835-.402 1.044-.7zm2.185 8.958c.037.6.343 1.245.882 1.377c.588.134 1.434-.333 1.791-.765l.211-.01c.315-.007.577.01.847.268l.003.003c.208.199.305.53.391.876c.085.4.154.78.409 1.066c.486.527.645.906.636 1.14l.003-.007v.018l-.003-.012c-.015.262-.185.396-.498.595c-.63.401-1.746.712-2.457 1.57c-.618.737-1.37 1.14-2.036 1.191c-.664.053-1.237-.2-1.574-.898l-.005-.003c-.21-.4-.12-1.025.056-1.69c.176-.668.428-1.344.463-1.897c.037-.714.076-1.335.195-1.814c.12-.465.308-.797.641-.984l.045-.022zm-10.814.049h.01q.08 0 .157.014c.376.055.706.333 1.023.752l.91 1.664l.003.003c.243.533.754 1.064 1.189 1.637c.434.598.77 1.131.729 1.57v.006c-.057.744-.48 1.148-1.125 1.294c-.645.135-1.52.002-2.395-.464c-.968-.536-2.118-.469-2.857-.602q-.553-.1-.723-.4c-.11-.2-.113-.602.123-1.23v-.004l.002-.003c.117-.334.03-.752-.027-1.118c-.055-.401-.083-.71.043-.94c.16-.334.396-.4.69-.533c.294-.135.64-.202.915-.47h.002v-.002c.256-.268.445-.601.668-.838c.19-.201.38-.336.663-.336m7.159-9.074c-.435.201-.945.535-1.488.535c-.542 0-.97-.267-1.28-.466c-.154-.134-.28-.268-.373-.335c-.164-.134-.144-.333-.074-.333c.109.016.129.134.199.2c.096.066.215.2.36.333c.292.2.68.467 1.167.467c.485 0 1.053-.267 1.398-.466c.195-.135.445-.334.648-.467c.156-.136.149-.267.279-.267c.128.016.034.134-.147.332a8 8 0 0 1-.69.468zm-1.082-1.583V5.64c-.006-.02.013-.042.029-.05c.074-.043.18-.027.26.004c.063 0 .16.067.15.135c-.006.049-.085.066-.135.066c-.055 0-.092-.043-.141-.068c-.052-.018-.146-.008-.163-.065m-.551 0c-.02.058-.113.049-.166.066c-.047.025-.086.068-.14.068c-.05 0-.13-.02-.136-.068c-.01-.066.088-.133.15-.133c.08-.031.184-.047.259-.005c.019.009.036.03.03.05v.02h.003z",
  },
  "Windows x64": {
    viewBox: "0 0 24 24",
    d: "M3 12V6.75l6-1.32v6.48zm17-9v8.75l-10 .15V5.21zM3 13l6 .09v6.81l-6-1.15zm17 .25V22l-10-1.91V13.1z",
  },
};

function TabLabel({ label }: { label: string }) {
  const icon = tabIconByLabel[label];

  if (!icon) {
    return <>{label}</>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <svg
        aria-hidden="true"
        className="size-4 shrink-0"
        fill="none"
        focusable="false"
        viewBox={icon.viewBox}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={icon.d} fill="currentColor" />
      </svg>
      <span>{label}</span>
    </span>
  );
}

function MdxTabs({ items, defaultValue, children, ...props }: MdxTabsProps) {
  return (
    <BaseTabs.Tabs defaultValue={defaultValue ?? items[0]} {...props}>
      <BaseTabs.TabsList className="mb-4 inline-flex flex-wrap gap-1 rounded-xl border p-1">
        {items.map((item) => (
          <BaseTabs.TabsTrigger
            key={item}
            value={item}
            className="rounded-lg px-3 py-1.5 text-sm text-fd-muted-foreground transition data-[state=active]:bg-fd-card data-[state=active]:text-fd-foreground"
          >
            <TabLabel label={item} />
          </BaseTabs.TabsTrigger>
        ))}
      </BaseTabs.TabsList>
      {children}
    </BaseTabs.Tabs>
  );
}

function MdxTab(props: ComponentProps<typeof BaseTabs.TabsContent>) {
  return <BaseTabs.TabsContent className="mt-2" {...props} />;
}

const mdxComponents = {
  ...defaultMdxComponents,
  Tabs: MdxTabs,
  Tab: MdxTab,
};

const pathToDocSlug = (path: string): string | null => {
  const normalized = path.replace(/\\/g, "/");
  const markers = ["/content/docs/", "content/docs/"];
  const marker = markers.find((candidate) => normalized.includes(candidate));
  if (!marker) {
    return null;
  }

  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const relative = normalized.slice(markerIndex + marker.length).replace(/\.(mdx|md)$/i, "");
  const localeStripped = relative.startsWith("es/")
    ? relative.slice("es/".length)
    : relative.startsWith("en/")
      ? relative.slice("en/".length)
      : relative;
  if (localeStripped === "index") {
    return "";
  }
  if (localeStripped.endsWith("/index")) {
    return localeStripped.slice(0, -"/index".length);
  }
  return localeStripped;
};

const spanishDocModules = (() => {
  const map: Partial<Record<string, () => Promise<typeof import("*.mdx")>>> = {};
  for (const [path, loader] of Object.entries(rawSpanishDocModuleLoaders)) {
    const slug = pathToDocSlug(path);
    if (slug === null) {
      continue;
    }

    map[slug] = loader;
    if (slug.length === 0) {
      map.index = loader;
    } else {
      map[`${slug}/index`] = loader;
    }
  }
  return map;
})();

const getDocModule = (slug: string) => spanishDocModules[slug] ?? englishDocModules[slug];

const UPPERCASE_SEGMENTS = new Set([
  "api",
  "aws",
  "cli",
  "ec2",
  "ecs",
  "iam",
  "rds",
  "sdk",
  "s3",
  "vpc",
]);

const humanizeSlugSegment = (segment: string): string =>
  segment
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => {
      const lower = part.toLowerCase();
      if (UPPERCASE_SEGMENTS.has(lower)) {
        return lower.toUpperCase();
      }
      return part[0]?.toUpperCase() + part.slice(1);
    })
    .join(" ");

const buildFrontmatterBySlug = (sources: Record<string, unknown>) => {
  const map = new Map<string, DocFrontmatter>();
  for (const [path, sourceValue] of Object.entries(sources)) {
    const slug = pathToDocSlug(path);
    if (slug === null) {
      continue;
    }

    const source = readRawDocSource(sourceValue);
    if (source === null) {
      continue;
    }

    const frontmatter = parseFrontmatter(source);
    map.set(slug, frontmatter);
    if (slug.length > 0) {
      map.set(`${slug}/index`, frontmatter);
    } else {
      map.set("index", frontmatter);
    }
  }
  return map;
};

const frontmatterBySlugEn = buildFrontmatterBySlug(rawEnglishDocSources);
const frontmatterBySlugEs = buildFrontmatterBySlug(rawSpanishDocSources);

const getCanonicalSlug = (slug: string): string => {
  if (slug === "index") {
    return "";
  }
  if (slug.endsWith("/index")) {
    return slug.slice(0, -"/index".length);
  }
  return slug;
};

const getFrontmatterForSlug = (slug: string): DocFrontmatter =>
  frontmatterBySlugEs.get(slug) ??
  frontmatterBySlugEn.get(slug) ??
  frontmatterBySlugEs.get("index") ??
  frontmatterBySlugEn.get("index") ??
  {};

const getFallbackTitleForSlug = (slug: string): string =>
  slug ? humanizeSlugSegment(slug.split("/").at(-1) ?? "docs") : "Docs";

const docsSeoForSlug = (slug: string) => {
  const normalizedSlug = slug || "";
  const canonicalSlug = getCanonicalSlug(normalizedSlug);
  const frontmatter = getFrontmatterForSlug(normalizedSlug);
  const pageTitle = frontmatter.title ?? getFallbackTitleForSlug(normalizedSlug);
  const title = seoTitle(pageTitle, "es");
  const description = frontmatter.description ?? defaultDocsDescriptionEs ?? defaultDocsDescription;
  const path = canonicalSlug ? `/es/docs/${canonicalSlug}` : "/es/docs";

  return { title, description, path };
};

export const Route = createFileRoute("/es/docs/$")({
  loader: async ({ params }) => {
    const slug = params["_splat"] || "";
    const docModule = getDocModule(slug);

    if (!docModule) {
      throw notFound();
    }

    // Preload the module during route transition
    // This warms up the module cache so the import in the component resolves instantly
    await docModule();

    return { slug };
  },
  head: ({ params }) => {
    const slug = params["_splat"] || "";
    const seo = docsSeoForSlug(slug);
    return {
      meta: buildSeoMeta(seo),
      links: [buildCanonicalLink(seo.path)],
    };
  },
  component: DocsPageComponent,
  staleTime: 0,
});

function DocsPageComponent() {
  // Get slug from params - they're always available immediately
  const params = Route.useParams();
  const slug = params["_splat"] || "";
  const docsPath = slug ? `/docs/${slug}` : "/docs";

  type DocModule = Awaited<ReturnType<(typeof englishDocModules)[string]>>;

  const [docModule, setDocModule] = useState<DocModule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setDocModule(null);

    const loadModule = async () => {
      try {
        const moduleLoader = getDocModule(slug);
        if (!moduleLoader) {
          throw notFound();
        }
        const loadedModule = await moduleLoader();
        setDocModule(loadedModule);
      } catch (err) {
        if (err instanceof Error) {
          setError(err);
          return;
        }
        throw err;
      } finally {
        setIsLoading(false);
      }
    };

    void loadModule();
  }, [slug]);

  if (isLoading) {
    return (
      <I18nProvider
        locale="es"
        translations={{
          toc: "En esta página",
          tocNoHeadings: "Sin encabezados",
          search: "Buscar",
          searchNoResult: "Sin resultados",
          lastUpdate: "Última actualización",
          nextPage: "Siguiente",
          previousPage: "Anterior",
          chooseLanguage: "Elegir idioma",
          chooseTheme: "Elegir tema",
          editOnGithub: "Editar en GitHub",
        }}
      >
        <DocsLayout tree={getDocsTree("es")} {...baseOptions("es", docsPath)}>
          <DocsPage
            toc={[]}
            full={false}
            tableOfContent={{ style: "clerk" }}
            tableOfContentPopover={{ style: "clerk" }}
          >
            <DocsBody>
              <div className="p-4">Cargando...</div>
            </DocsBody>
          </DocsPage>
        </DocsLayout>
      </I18nProvider>
    );
  }

  if (error) {
    throw error;
  }

  if (!docModule) {
    throw notFound();
  }

  const MDXContent = docModule.default;
  const toc = readToc(docModule);

  return (
    <I18nProvider
      locale="es"
      translations={{
        toc: "En esta página",
        tocNoHeadings: "Sin encabezados",
        search: "Buscar",
        searchNoResult: "Sin resultados",
        lastUpdate: "Última actualización",
        nextPage: "Siguiente",
        previousPage: "Anterior",
        chooseLanguage: "Elegir idioma",
        chooseTheme: "Elegir tema",
        editOnGithub: "Editar en GitHub",
      }}
    >
      <DocsLayout tree={getDocsTree("es")} {...baseOptions("es", docsPath)}>
        <DocsPage
          toc={toc ?? []}
          full={false}
          tableOfContent={{ style: "clerk" }}
          tableOfContentPopover={{ style: "clerk" }}
        >
          <DocsBody>
            <CopyMarkdownButton
              markdownPath={slug ? `/api/llms-page/es/${slug}` : "/api/llms-page/es"}
              labels={{
                copy: "Copiar Markdown",
                copied: "Copiado",
                failed: "Error al copiar",
              }}
            />
            <ErrorBoundary
              fallback={
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="font-semibold">No se pudo cargar la documentación</div>
                  <div className="mt-1 text-amber-800">
                    Esto suele ser un desajuste de caché después de un deploy. Prueba un hard
                    refresh.
                  </div>
                </div>
              }
            >
              <MDXContent components={mdxComponents} />
            </ErrorBoundary>
          </DocsBody>
        </DocsPage>
      </DocsLayout>
    </I18nProvider>
  );
}
