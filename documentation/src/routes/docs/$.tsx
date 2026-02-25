import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsPage, DocsBody } from "fumadocs-ui/page";
import { useEffect, useState } from "react";

import { CopyMarkdownButton } from "@/components/copy-markdown-button";
import { ErrorBoundary } from "@/components/error-boundary";
import { getDocsTree } from "@/lib/docs-tree";
import { baseOptions } from "@/lib/layout.shared";
import { buildCanonicalLink, buildSeoMeta, defaultDocsDescription, seoTitle } from "@/lib/seo";

const docModules: Record<string, () => Promise<typeof import("*.mdx")>> = {
  "": () => import("../../../content/docs/en/index.mdx"),
  index: () => import("../../../content/docs/en/index.mdx"),
  cli: () => import("../../../content/docs/en/cli/index.mdx"),
  "cli/index": () => import("../../../content/docs/en/cli/index.mdx"),
  "cli/installation": () => import("../../../content/docs/en/cli/installation.mdx"),
  "cli/build-cli": () => import("../../../content/docs/en/cli/build-cli.mdx"),
  "cli/configuration": () => import("../../../content/docs/en/cli/configuration.mdx"),
  "cli/choose-command": () => import("../../../content/docs/en/cli/choose-command.mdx"),
  "cli/scan-profiles": () => import("../../../content/docs/en/cli/scan-profiles.mdx"),
  "cli/exit-codes": () => import("../../../content/docs/en/cli/exit-codes.mdx"),
  "cli/troubleshooting": () => import("../../../content/docs/en/cli/troubleshooting.mdx"),
  "cli/commands": () => import("../../../content/docs/en/cli/commands/index.mdx"),
  "cli/commands/index": () => import("../../../content/docs/en/cli/commands/index.mdx"),
  "cli/commands/init": () => import("../../../content/docs/en/cli/commands/init.mdx"),
  "cli/commands/describe": () => import("../../../content/docs/en/cli/commands/describe.mdx"),
  "cli/commands/query": () => import("../../../content/docs/en/cli/commands/query.mdx"),
  "cli/commands/use-letme": () => import("../../../content/docs/en/cli/commands/use-letme.mdx"),
  "cli/commands/config": () => import("../../../content/docs/en/cli/commands/config.mdx"),
  sdk: () => import("../../../content/docs/en/sdk/index.mdx"),
  "sdk/index": () => import("../../../content/docs/en/sdk/index.mdx"),
  "sdk/getting-started": () => import("../../../content/docs/en/sdk/getting-started.mdx"),
  "sdk/error-model": () => import("../../../content/docs/en/sdk/error-model.mdx"),
  "sdk/layers-and-runtime": () => import("../../../content/docs/en/sdk/layers-and-runtime.mdx"),
  "sdk/operations": () => import("../../../content/docs/en/sdk/operations.mdx"),
  "sdk/examples": () => import("../../../content/docs/en/sdk/examples.mdx"),
  "sdk/services-compute-storage": () =>
    import("../../../content/docs/en/sdk/services-compute-storage.mdx"),
  "sdk/services-data-networking": () =>
    import("../../../content/docs/en/sdk/services-data-networking.mdx"),
  "sdk/services-security-platform": () =>
    import("../../../content/docs/en/sdk/services-security-platform.mdx"),
  "sdk/utilities": () => import("../../../content/docs/en/sdk/utilities.mdx"),
  "sdk/reference-map": () => import("../../../content/docs/en/sdk/reference-map.mdx"),
  "sdk/api": () => import("../../../content/docs/en/sdk/api/index.mdx"),
  "sdk/api/index": () => import("../../../content/docs/en/sdk/api/index.mdx"),
  "sdk/api/core": () => import("../../../content/docs/en/sdk/api/core.mdx"),
  "sdk/api/operations": () => import("../../../content/docs/en/sdk/api/operations.mdx"),
  "sdk/api/services": () => import("../../../content/docs/en/sdk/api/services.mdx"),
  "sdk/api/lib": () => import("../../../content/docs/en/sdk/api/lib.mdx"),
  "sdk/api/types": () => import("../../../content/docs/en/sdk/api/types.mdx"),
  "sdk/api/credentials": () => import("../../../content/docs/en/sdk/api/credentials.mdx"),
};

const rawDocSources = import.meta.glob("../../../content/docs/en/**/*.{mdx,md}", {
  query: "?raw",
  import: "default",
  eager: true,
});

type DocFrontmatter = {
  title?: string;
  description?: string;
};

type TocItem = {
  title: string;
  url: string;
  depth: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isTocItem = (value: unknown): value is TocItem =>
  isRecord(value) &&
  typeof value.title === "string" &&
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

const pathToDocSlug = (path: string): string | null => {
  const normalized = path.replace(/\\/g, "/");
  const markers = ["/content/docs/en/", "content/docs/en/"];
  const marker = markers.find((candidate) => normalized.includes(candidate));
  if (!marker) {
    return null;
  }

  const markerIndex = normalized.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const relative = normalized.slice(markerIndex + marker.length).replace(/\.(mdx|md)$/i, "");
  if (relative === "index") {
    return "";
  }
  if (relative.endsWith("/index")) {
    return relative.slice(0, -"/index".length);
  }
  return relative;
};

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

const frontmatterBySlug = (() => {
  const map = new Map<string, DocFrontmatter>();
  for (const [path, sourceValue] of Object.entries(rawDocSources)) {
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
})();

const docsSeoForSlug = (slug: string) => {
  const normalizedSlug = slug || "";
  const canonicalSlug =
    normalizedSlug === "index"
      ? ""
      : normalizedSlug.endsWith("/index")
        ? normalizedSlug.slice(0, -"/index".length)
        : normalizedSlug;
  const frontmatter = frontmatterBySlug.get(normalizedSlug) ?? frontmatterBySlug.get("index") ?? {};

  const fallbackTitle = normalizedSlug
    ? humanizeSlugSegment(normalizedSlug.split("/").at(-1) ?? "docs")
    : "Docs";
  const pageTitle = frontmatter.title ?? fallbackTitle;
  const title = seoTitle(pageTitle);
  const description = frontmatter.description ?? defaultDocsDescription;
  const path = canonicalSlug ? `/docs/${canonicalSlug}` : "/docs";

  return { title, description, path };
};

export const Route = createFileRoute("/docs/$")({
  loader: async ({ params }) => {
    const slug = params["_splat"] || "";
    const docModule = docModules[slug];

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

  type DocModule = Awaited<ReturnType<(typeof docModules)[string]>>;

  const [docModule, setDocModule] = useState<DocModule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setDocModule(null);

    const loadModule = async () => {
      try {
        const moduleLoader = docModules[slug];
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
      <DocsLayout tree={getDocsTree("en")} {...baseOptions("en", docsPath)}>
        <DocsPage toc={[]} full={false}>
          <DocsBody>
            <div className="p-4">Loading...</div>
          </DocsBody>
        </DocsPage>
      </DocsLayout>
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
    <DocsLayout tree={getDocsTree("en")} {...baseOptions("en", docsPath)}>
      <DocsPage toc={toc ?? []} full={false}>
        <DocsBody>
          <CopyMarkdownButton
            markdownPath={slug ? `/api/llms-page/en/${slug}` : "/api/llms-page/en"}
          />
          <ErrorBoundary
            fallback={
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="font-semibold">Documentation failed to load</div>
                <div className="mt-1 text-amber-800">
                  This is usually a cached chunk mismatch after a deploy. Try a hard refresh.
                </div>
              </div>
            }
          >
            <MDXContent components={defaultMdxComponents} />
          </ErrorBoundary>
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  );
}
