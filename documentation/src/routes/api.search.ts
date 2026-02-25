import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { createFromSource } from "fumadocs-core/search/server";
import { loader } from "fumadocs-core/source";

import { isLocale, type Locale } from "@/lib/i18n";

import { docs, docsEs } from "../../.source/server";

const sources = {
  en: loader(docs.toFumadocsSource(), {
    baseUrl: "/en/docs",
  }),
  es: loader(docsEs.toFumadocsSource(), {
    baseUrl: "/es/docs",
  }),
} as const;

const searches = {
  en: createFromSource(sources.en),
  es: createFromSource(sources.es),
} as const;

const localeFromPathname = (pathname: string): Locale => {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;

  for (const locale of ["en", "es"] as const) {
    if (normalized === `/${locale}` || normalized.startsWith(`/${locale}/`)) {
      return locale;
    }
  }

  return "en";
};

const resolveSearchLocale = (request: Request): Locale => {
  const requestUrl = new URL(request.url);
  const requestedLocale = requestUrl.searchParams.get("locale");

  if (requestedLocale !== null && isLocale(requestedLocale)) {
    return requestedLocale;
  }

  const referer = request.headers.get("referer");
  if (referer !== null) {
    return Effect.runSync(
      Effect.try({
        try: () => new URL(referer).pathname,
        catch: () => new Error("Invalid referer URL"),
      }).pipe(
        Effect.map(localeFromPathname),
        Effect.catchAll(() => Effect.succeed<Locale>("en")),
      ),
    );
  }

  return "en";
};

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: ({ request }) => searches[resolveSearchLocale(request)].GET(request),
    },
  },
});
