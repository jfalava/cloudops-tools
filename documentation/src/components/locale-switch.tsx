import type { Locale } from "@/lib/i18n";
import { localizePath } from "@/lib/i18n";

type LocaleSwitchProps = {
  currentLocale: Locale;
  path: string;
  className?: string;
};

export function LocaleSwitch({ currentLocale, path, className }: LocaleSwitchProps) {
  return (
    <div className={className}>
      <div className="inline-flex items-center gap-1 rounded-md border px-1 py-1 text-xs">
        <LocaleLink locale="en" currentLocale={currentLocale} path={path} />
        <LocaleLink locale="es" currentLocale={currentLocale} path={path} />
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

