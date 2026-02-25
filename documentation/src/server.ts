import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";

const pickLocaleFromAcceptLanguage = (headerValue: string | null): "en" | "es" => {
  if (!headerValue) {
    return "en";
  }

  return headerValue.toLowerCase().startsWith("es") ? "es" : "en";
};

const docsMarkdownRewriters = [
  rewritePath("/docs{/*path}", "/api/llms-page/en{/*path}"),
  rewritePath("/en/docs{/*path}", "/api/llms-page/en{/*path}"),
  rewritePath("/es/docs{/*path}", "/api/llms-page/es{/*path}"),
];

const rewriteDocsPathToLlmPath = (pathname: string): string | null => {
  for (const rewriter of docsMarkdownRewriters) {
    const rewritten = rewriter.rewrite(pathname);
    if (rewritten) {
      return rewritten;
    }
  }

  return null;
};

const stripMarkdownExtension = (pathname: string): string | null => {
  if (!pathname.match(/\.(md|mdx)$/i)) {
    return null;
  }

  return pathname.replace(/\.(md|mdx)$/i, "");
};

export default createServerEntry({
  async fetch(request, opts) {
    const url = new URL(request.url);

    if (url.pathname === "/llms-full.txt") {
      const rewritten = new Request(new URL("/api/llms-full", url.origin), request);
      return handler.fetch(rewritten, opts);
    }

    const explicitMarkdownPath = stripMarkdownExtension(url.pathname);
    if (explicitMarkdownPath) {
      const llmPath = rewriteDocsPathToLlmPath(explicitMarkdownPath);
      if (llmPath) {
        const rewritten = new Request(new URL(`${llmPath}${url.search}`, url.origin), request);
        return handler.fetch(rewritten, opts);
      }
    }

    if (isMarkdownPreferred(request)) {
      const llmPath = rewriteDocsPathToLlmPath(url.pathname);
      if (llmPath) {
        const rewritten = new Request(new URL(`${llmPath}${url.search}`, url.origin), request);
        return handler.fetch(rewritten, opts);
      }
    }

    if (url.pathname === "/") {
      const locale = pickLocaleFromAcceptLanguage(request.headers.get("accept-language"));
      const target = new URL(`/${locale}${url.search}`, url.origin);
      return Response.redirect(target.toString(), 307);
    }

    return handler.fetch(request, opts);
  },
});
