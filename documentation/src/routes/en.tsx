import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import { Footer, Header, Hero } from "@/components/landing";
import { buildCanonicalLink, buildSeoMeta, seoTitle } from "@/lib/seo";

export const Route = createFileRoute("/en")({
  head: () => ({
    meta: buildSeoMeta({
      title: seoTitle("Documentation"),
      description:
        "CloudOps Tools docs for the AWS inventory CLI and SDK: installation, command reference, guides, and API docs.",
      path: "/en",
    }),
    links: [buildCanonicalLink("/en")],
  }),
  component: EnglishLandingPage,
});

function EnglishLandingPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/en") {
    return <Outlet />;
  }

  return (
    <div className="from-background to-muted/20 flex min-h-screen flex-col bg-linear-to-b">
      <Header locale="en" />
      <Hero locale="en" />
      <Footer />
    </div>
  );
}

