import { defineDocs, defineConfig } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs/en",
});

export const docsEs = defineDocs({
  dir: "content/docs/es",
});

export default defineConfig();
