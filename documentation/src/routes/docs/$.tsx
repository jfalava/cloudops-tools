import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsPage, DocsBody } from "fumadocs-ui/page";
import { useEffect, useState } from "react";

import { ErrorBoundary } from "@/components/error-boundary";
import { docsTree } from "@/lib/docs-tree";
import { baseOptions } from "@/lib/layout.shared";

const docModules: Record<string, () => Promise<typeof import("*.mdx")>> = {
  "": () => import("../../../content/docs/index.mdx"),
  index: () => import("../../../content/docs/index.mdx"),
  installation: () => import("../../../content/docs/installation.mdx"),
  "build-cli": () => import("../../../content/docs/build-cli.mdx"),
  configuration: () => import("../../../content/docs/configuration.mdx"),
  "choose-command": () => import("../../../content/docs/choose-command.mdx"),
  "scan-profiles": () => import("../../../content/docs/scan-profiles.mdx"),
  troubleshooting: () => import("../../../content/docs/troubleshooting.mdx"),
  commands: () => import("../../../content/docs/commands/index.mdx"),
  "commands/index": () => import("../../../content/docs/commands/index.mdx"),
  "commands/init": () => import("../../../content/docs/commands/init.mdx"),
  "commands/describe": () => import("../../../content/docs/commands/describe.mdx"),
  "commands/setup-totp": () => import("../../../content/docs/commands/setup-totp.mdx"),
  "commands/use-letme": () => import("../../../content/docs/commands/use-letme.mdx"),
  "commands/config": () => import("../../../content/docs/commands/config.mdx"),
  sdk: () => import("../../../content/docs/sdk/index.mdx"),
  "sdk/index": () => import("../../../content/docs/sdk/index.mdx"),
  "sdk/getting-started": () => import("../../../content/docs/sdk/getting-started.mdx"),
  "sdk/error-model": () => import("../../../content/docs/sdk/error-model.mdx"),
  "sdk/layers-and-runtime": () => import("../../../content/docs/sdk/layers-and-runtime.mdx"),
  "sdk/operations": () => import("../../../content/docs/sdk/operations.mdx"),
  "sdk/examples": () => import("../../../content/docs/sdk/examples.mdx"),
  "sdk/services-compute-storage": () =>
    import("../../../content/docs/sdk/services-compute-storage.mdx"),
  "sdk/services-data-networking": () =>
    import("../../../content/docs/sdk/services-data-networking.mdx"),
  "sdk/services-security-platform": () =>
    import("../../../content/docs/sdk/services-security-platform.mdx"),
  "sdk/utilities": () => import("../../../content/docs/sdk/utilities.mdx"),
  "sdk/reference-map": () => import("../../../content/docs/sdk/reference-map.mdx"),
  "sdk/api": () => import("../../../content/docs/sdk/api/index.mdx"),
  "sdk/api/index": () => import("../../../content/docs/sdk/api/index.mdx"),
  "sdk/api/core": () => import("../../../content/docs/sdk/api/core.mdx"),
  "sdk/api/operations": () => import("../../../content/docs/sdk/api/operations.mdx"),
  "sdk/api/services": () => import("../../../content/docs/sdk/api/services.mdx"),
  "sdk/api/lib": () => import("../../../content/docs/sdk/api/lib.mdx"),
  "sdk/api/types": () => import("../../../content/docs/sdk/api/types.mdx"),
  "sdk/api/credentials": () => import("../../../content/docs/sdk/api/credentials.mdx"),
};

export const Route = createFileRoute("/docs/$")({
  component: DocsPageComponent,
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
  staleTime: 0,
});

function DocsPageComponent() {
  // Get slug from params - they're always available immediately
  const params = Route.useParams();
  const slug = params["_splat"] || "";

  const [MDXContent, setMDXContent] = useState<React.ComponentType<{
    components?: Record<string, React.ComponentType<Record<string, unknown>>>;
  }> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setMDXContent(null);

    const loadModule = async () => {
      try {
        const docModule = docModules[slug];
        if (!docModule) {
          throw notFound();
        }
        const module = await docModule();
        setMDXContent(() => module.default);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    loadModule().catch((err: unknown) => {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    });
  }, [slug]);

  if (isLoading) {
    return (
      <DocsLayout tree={docsTree} {...baseOptions()}>
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

  if (!MDXContent) {
    throw notFound();
  }

  return (
    <DocsLayout tree={docsTree} {...baseOptions()}>
      <DocsPage toc={[]} full={false}>
        <DocsBody>
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
            <MDXContent
              components={
                defaultMdxComponents as unknown as Record<
                  string,
                  React.ComponentType<Record<string, unknown>>
                >
              }
            />
          </ErrorBoundary>
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  );
}
