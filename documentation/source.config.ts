import { defineDocs, defineConfig } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs/en",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export const docsEs = defineDocs({
  dir: "content/docs/es",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig();
