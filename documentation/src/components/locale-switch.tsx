import { localizePath, stripLocalePrefix, type Locale } from "@/lib/i18n";

type LocaleSwitchProps = {
  currentLocale: Locale;
  path: string;
  className?: string;
};

export function LocaleSwitch({ currentLocale, path, className }: LocaleSwitchProps) {
  const basePath = stripLocalePrefix(path).path;

  return (
    <div className={className}>
      <div className="inline-flex items-center gap-1 rounded-md border px-1 py-1 text-xs">
        <LocaleLink locale="en" currentLocale={currentLocale} path={basePath} />
        <LocaleLink locale="es" currentLocale={currentLocale} path={basePath} />
      </div>
    </div>
  );
}

function LocaleLink({
  locale,
  currentLocale,
  path,
}: {
  locale: Locale;
  currentLocale: Locale;
  path: string;
}) {
  const active = locale === currentLocale;

  return (
    <a
      href={localizePath(path, locale)}
      hrefLang={locale}
      lang={locale}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "bg-primary text-primary-foreground rounded px-2 py-1 font-medium"
          : "text-muted-foreground hover:text-foreground rounded px-2 py-1"
      }
    >
      {locale.toUpperCase()}
    </a>
  );
}
