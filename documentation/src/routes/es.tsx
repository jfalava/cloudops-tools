import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import { Footer, Header, Hero } from "@/components/landing";
import { buildCanonicalLink, buildSeoMeta, seoTitle } from "@/lib/seo";

export const Route = createFileRoute("/es")({
  head: () => ({
    meta: buildSeoMeta({
      title: seoTitle("Documentación", "es"),
      description:
        "Documentación de CloudOps Tools para el CLI de inventario AWS y el SDK: instalación, referencia de comandos, guías y API.",
      path: "/es",
    }),
    links: [buildCanonicalLink("/es")],
  }),
  component: SpanishLandingPage,
});

function SpanishLandingPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/es") {
    return <Outlet />;
  }

  return (
    <div className="from-background to-muted/20 flex min-h-screen flex-col bg-linear-to-b">
      <Header locale="es" />
      <Hero locale="es" />
      <Footer />
    </div>
  );
}
