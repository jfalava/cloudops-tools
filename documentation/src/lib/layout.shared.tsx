import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { DocsSidebarControls } from "@/components/docs-sidebar-controls";
import type { Locale } from "@/lib/i18n";

export function baseOptions(locale: Locale = "en", docsPath?: string): BaseLayoutProps {
  return {
    nav: {
      title: locale === "es" ? "CloudOps Tools" : "CloudOps Tools",
    },
    themeSwitch: docsPath
      ? {
          component: (
            <DocsSidebarControls locale={locale} path={docsPath} />
          ),
        }
      : undefined,
    githubUrl: "https://github.com/jfalava/cloudops-tools",
  };
}
