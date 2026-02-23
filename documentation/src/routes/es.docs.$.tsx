import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsPage, DocsBody } from "fumadocs-ui/page";
import { useEffect, useState } from "react";

import { LocaleSwitch } from "@/components/locale-switch";
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
  "": () => import("../../content/docs/index.mdx"),
  index: () => import("../../content/docs/index.mdx"),
  cli: () => import("../../content/docs/cli/index.mdx"),
  "cli/index": () => import("../../content/docs/cli/index.mdx"),
  "cli/installation": () => import("../../content/docs/cli/installation.mdx"),
  "cli/build-cli": () => import("../../content/docs/cli/build-cli.mdx"),
  "cli/configuration": () => import("../../content/docs/cli/configuration.mdx"),
  "cli/choose-command": () => import("../../content/docs/cli/choose-command.mdx"),
  "cli/scan-profiles": () => import("../../content/docs/cli/scan-profiles.mdx"),
  "cli/exit-codes": () => import("../../content/docs/cli/exit-codes.mdx"),
  "cli/troubleshooting": () => import("../../content/docs/cli/troubleshooting.mdx"),
  "cli/commands": () => import("../../content/docs/cli/commands/index.mdx"),
  "cli/commands/index": () => import("../../content/docs/cli/commands/index.mdx"),
  "cli/commands/init": () => import("../../content/docs/cli/commands/init.mdx"),
  "cli/commands/describe": () => import("../../content/docs/cli/commands/describe.mdx"),
  "cli/commands/query": () => import("../../content/docs/cli/commands/query.mdx"),
  "cli/commands/use-letme": () => import("../../content/docs/cli/commands/use-letme.mdx"),
  "cli/commands/config": () => import("../../content/docs/cli/commands/config.mdx"),
  sdk: () => import("../../content/docs/sdk/index.mdx"),
  "sdk/index": () => import("../../content/docs/sdk/index.mdx"),
  "sdk/getting-started": () => import("../../content/docs/sdk/getting-started.mdx"),
  "sdk/error-model": () => import("../../content/docs/sdk/error-model.mdx"),
  "sdk/layers-and-runtime": () => import("../../content/docs/sdk/layers-and-runtime.mdx"),
  "sdk/operations": () => import("../../content/docs/sdk/operations.mdx"),
  "sdk/examples": () => import("../../content/docs/sdk/examples.mdx"),
  "sdk/services-compute-storage": () =>
    import("../../content/docs/sdk/services-compute-storage.mdx"),
  "sdk/services-data-networking": () =>
    import("../../content/docs/sdk/services-data-networking.mdx"),
  "sdk/services-security-platform": () =>
    import("../../content/docs/sdk/services-security-platform.mdx"),
  "sdk/utilities": () => import("../../content/docs/sdk/utilities.mdx"),
  "sdk/reference-map": () => import("../../content/docs/sdk/reference-map.mdx"),
  "sdk/api": () => import("../../content/docs/sdk/api/index.mdx"),
  "sdk/api/index": () => import("../../content/docs/sdk/api/index.mdx"),
  "sdk/api/core": () => import("../../content/docs/sdk/api/core.mdx"),
  "sdk/api/operations": () => import("../../content/docs/sdk/api/operations.mdx"),
  "sdk/api/services": () => import("../../content/docs/sdk/api/services.mdx"),
  "sdk/api/lib": () => import("../../content/docs/sdk/api/lib.mdx"),
  "sdk/api/types": () => import("../../content/docs/sdk/api/types.mdx"),
  "sdk/api/credentials": () => import("../../content/docs/sdk/api/credentials.mdx"),
};

const rawSpanishDocModuleLoaders = import.meta.glob("../../content/docs/es/**/*.{mdx,md}") as Record<
  string,
  () => Promise<typeof import("*.mdx")>
>;

const rawEnglishDocSources = import.meta.glob("../../content/docs/**/*.{mdx,md}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, unknown>;

const rawSpanishDocSources = import.meta.glob("../../content/docs/es/**/*.{mdx,md}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, unknown>;

type DocFrontmatter = {
  title?: string;
  description?: string;
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
  const localeStripped = relative.startsWith("es/") ? relative.slice("es/".length) : relative;
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

const docsSeoForSlug = (slug: string) => {
  const normalizedSlug = slug || "";
  const canonicalSlug =
    normalizedSlug === "index"
      ? ""
      : normalizedSlug.endsWith("/index")
        ? normalizedSlug.slice(0, -"/index".length)
        : normalizedSlug;
  const frontmatter =
    frontmatterBySlugEs.get(normalizedSlug) ??
    frontmatterBySlugEn.get(normalizedSlug) ??
    frontmatterBySlugEs.get("index") ??
    frontmatterBySlugEn.get("index") ??
    {};

  const fallbackTitle = normalizedSlug
    ? humanizeSlugSegment(normalizedSlug.split("/").at(-1) ?? "docs")
    : "Docs";
  const pageTitle = frontmatter.title ?? fallbackTitle;
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
      <DocsLayout tree={getDocsTree("es")} {...baseOptions("es")}>
        <DocsPage toc={[]} full={false}>
          <DocsBody>
            <div className="flex items-center justify-end p-4 pb-0">
              <LocaleSwitch currentLocale="es" path={slug ? `/docs/${slug}` : "/docs"} />
            </div>
            <div className="p-4 pt-2">Cargando...</div>
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

  return (
    <DocsLayout tree={getDocsTree("es")} {...baseOptions("es")}>
      <DocsPage toc={[]} full={false}>
        <DocsBody>
          <div className="mb-4 flex items-center justify-end">
            <LocaleSwitch currentLocale="es" path={slug ? `/docs/${slug}` : "/docs"} />
          </div>
          <ErrorBoundary
            fallback={
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="font-semibold">No se pudo cargar la documentación</div>
                <div className="mt-1 text-amber-800">
                  Esto suele ser un desajuste de caché después de un deploy. Prueba un hard refresh.
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
