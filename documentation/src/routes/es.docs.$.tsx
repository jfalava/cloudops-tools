import { createFileRoute, notFound } from "@tanstack/react-router";
import { I18nProvider } from "fumadocs-ui/contexts/i18n";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsPage, DocsBody } from "fumadocs-ui/page";
import { useEffect, useState } from "react";

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
          <DocsPage toc={[]} full={false}>
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
  const toc = (docModule as Record<string, unknown>).toc as
    | { title: string; url: string; depth: number }[]
    | undefined;

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
        <DocsPage toc={toc ?? []} full={false}>
          <DocsBody>
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
              <MDXContent components={defaultMdxComponents} />
            </ErrorBoundary>
          </DocsBody>
        </DocsPage>
      </DocsLayout>
    </I18nProvider>
  );
}
