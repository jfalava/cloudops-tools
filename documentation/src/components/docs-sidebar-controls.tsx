import { Moon, Sun } from "lucide-react";

import { LocaleSwitch } from "@/components/locale-switch";
import type { Locale } from "@/lib/i18n";

type DocsSidebarControlsProps = {
  locale: Locale;
  path: string;
};

const toggleTheme = () => {
  if (typeof window === "undefined") {
    return;
  }

  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const storedTheme = window.localStorage.getItem("theme");
  const isDark =
    storedTheme === "dark" ||
    (storedTheme !== "light" && document.documentElement.classList.contains("dark")) ||
    (storedTheme === null && systemPrefersDark && !document.documentElement.classList.contains("dark"));

  const nextTheme = isDark ? "light" : "dark";
  window.localStorage.setItem("theme", nextTheme);
  document.documentElement.classList.toggle("dark", nextTheme === "dark");
};

export function DocsSidebarControls({ locale, path }: DocsSidebarControlsProps) {
  return (
    <div className="ms-auto flex items-center gap-2">
      <LocaleSwitch currentLocale={locale} path={path} />
      <button
        type="button"
        aria-label="Toggle theme"
        title="Toggle theme"
        onClick={toggleTheme}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm hover:bg-accent/60"
      >
        <Sun className="hidden h-4 w-4 dark:block" />
        <Moon className="h-4 w-4 dark:hidden" />
      </button>
    </div>
  );
}
