import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { buildCanonicalLink, buildSeoMeta, seoTitle } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: buildSeoMeta({
      title: seoTitle("Documentation"),
      description:
        "CloudOps Tools docs for the AWS inventory CLI and SDK: installation, command reference, guides, and API docs.",
      path: "/",
    }),
    links: [buildCanonicalLink("/")],
  }),
  component: LocaleRedirectPage,
});

function LocaleRedirectPage() {
  useEffect(() => {
    const browserLanguage =
      (typeof navigator !== "undefined" && (navigator.languages?.[0] ?? navigator.language)) || "";
    const nextPath = browserLanguage.toLowerCase().startsWith("es") ? "/es" : "/en";
    window.location.replace(nextPath);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-sm text-neutral-500">
      Redirecting to your language...
    </div>
  );
}
