import { createFileRoute } from "@tanstack/react-router";
import { loader, type InferPageType } from "fumadocs-core/source";

import { docs, docsEs } from "../../.source/server";

const sourceEn = loader(docs.toFumadocsSource(), {
  baseUrl: "/en/docs",
});

const sourceEs = loader(docsEs.toFumadocsSource(), {
  baseUrl: "/es/docs",
});

type Page = InferPageType<typeof sourceEn> | InferPageType<typeof sourceEs>;

const getLLMText = async (page: Page): Promise<string> => {
  const processed = await page.data.getText("processed");

  return `# ${page.data.title} (${page.url})\n\n${processed}`;
};

export const Route = createFileRoute("/api/llms-full")({
  server: {
    handlers: {
      GET: async () => {
        const scan = [...sourceEn.getPages(), ...sourceEs.getPages()].map(getLLMText);
        const scanned = await Promise.all(scan);

        return new Response(scanned.join("\n\n"), {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
