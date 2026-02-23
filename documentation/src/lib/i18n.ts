export const SUPPORTED_LOCALES = ["en", "es"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (value: string): value is Locale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(value);

export const localeLabel = (locale: Locale): string => {
  if (locale === "es") {
    return "Español";
  }
  return "English";
};

export const localizePath = (path: string, locale: Locale): string => {
  if (path === `/${locale}`) {
    return path;
  }
  if (path === "/") {
    return `/${locale}`;
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized.startsWith(`/${locale}/`)) {
    return normalized;
  }
  return `/${locale}${normalized}`;
};

export const stripLocalePrefix = (pathname: string): { locale: Locale; path: string } => {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;

  for (const locale of SUPPORTED_LOCALES) {
    if (normalized === `/${locale}`) {
      return { locale, path: "/" };
    }

    if (normalized.startsWith(`/${locale}/`)) {
      return { locale, path: normalized.slice(locale.length + 1) };
    }
  }

  return { locale: "en", path: normalized };
};

export const toggleLocalePath = (pathname: string, nextLocale: Locale): string => {
  const { path } = stripLocalePrefix(pathname);
  return localizePath(path, nextLocale);
};
