// @ts-nocheck
/// <reference types="vite/client" />
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", import.meta.glob(["./**/*.{mdx,md}"], {
    "base": "./../content/docs/en",
    "query": {
      "collection": "docs"
    },
    "eager": false
  })),
  docsEs: create.doc("docsEs", import.meta.glob(["./**/*.{mdx,md}"], {
    "base": "./../content/docs/es",
    "query": {
      "collection": "docsEs"
    },
    "eager": false
  })),
};
export default browserCollections;