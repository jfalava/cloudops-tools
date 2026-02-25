import { createFileRoute, notFound } from "@tanstack/react-router";
import { loader } from "fumadocs-core/source";

import { docs, docsEs } from "../../.source/server";

const sourceEn = loader(docs.toFumadocsSource(), {
  baseUrl: "/en/docs",
});

const sourceEs = loader(docsEs.toFumadocsSource(), {
  baseUrl: "/es/docs",
});

export const Route = createFileRoute("/api/llms-page/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const segments = (params["_splat"] ?? "").split("/").filter((s) => s.length > 0);
        const [first, ...rest] = segments;
        const locale = first === "es" ? "es" : first === "en" ? "en" : "en";
        const slugs = first === "es" || first === "en" ? rest : segments;
        const source = locale === "es" ? sourceEs : sourceEn;
        const page =
          locale === "es"
            ? (sourceEs.getPage(slugs) ?? sourceEn.getPage(slugs))
            : source.getPage(slugs);
        if (!page) {
          throw notFound();
        }

        const processed = await page.data.getText("processed");

        return new Response(`# ${page.data.title} (${page.url})\n\n${processed}`, {
          headers: { "Content-Type": "text/markdown; charset=utf-8" },
        });
      },
    },
  },
});
