import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

const pickLocaleFromAcceptLanguage = (headerValue: string | null): "en" | "es" => {
  if (!headerValue) {
    return "en";
  }

  return headerValue.toLowerCase().startsWith("es") ? "es" : "en";
};

export default createServerEntry({
  async fetch(request, opts) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      const locale = pickLocaleFromAcceptLanguage(request.headers.get("accept-language"));
      const target = new URL(`/${locale}${url.search}`, url.origin);
      return Response.redirect(target.toString(), 307);
    }

    return handler.fetch(request, opts);
  },
});
