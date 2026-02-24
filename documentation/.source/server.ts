// @ts-nocheck
/// <reference types="vite/client" />
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs/en", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../content/docs/en",
  "query": {
    "collection": "docs"
  },
  "import": "default",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../content/docs/en",
  "query": {
    "collection": "docs"
  },
  "eager": true
}));

export const docsEs = await create.docs("docsEs", "content/docs/es", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../content/docs/es",
  "query": {
    "collection": "docsEs"
  },
  "import": "default",
  "eager": true
}), import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../content/docs/es",
  "query": {
    "collection": "docsEs"
  },
  "eager": true
}));