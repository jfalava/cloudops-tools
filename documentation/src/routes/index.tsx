import { createFileRoute } from "@tanstack/react-router";

import { Footer, Header, Hero } from "@/components/landing";
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
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="from-background to-muted/20 flex min-h-screen flex-col bg-linear-to-b">
      <Header />
      <Hero />
      <Footer />
    </div>
  );
}
