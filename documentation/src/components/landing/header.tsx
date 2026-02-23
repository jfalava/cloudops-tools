import { BookOpen } from "lucide-react";

import type { Locale } from "@/lib/i18n";
import { localizePath } from "@/lib/i18n";

export function Header({ locale = "en" }: { locale?: Locale }) {
  const docsHome = localizePath("/docs", locale);
  const otherLocaleHref = locale === "es" ? "/" : "/es";
  const localeLabel = locale === "es" ? "English" : "Español";

  return (
    <header className="border-b px-6 py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <a href={docsHome} className="flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          <span className="text-lg font-semibold">CloudOps Tools</span>
        </a>
        <div className="flex items-center gap-4">
          <a href={otherLocaleHref} className="text-muted-foreground hover:text-foreground text-sm">
            {localeLabel}
          </a>
          <a
            href="https://github.com/jfalava/cloudops-tools"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
