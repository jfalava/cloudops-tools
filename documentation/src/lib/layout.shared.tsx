import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import type { Locale } from "@/lib/i18n";

export function baseOptions(locale: Locale = "en"): BaseLayoutProps {
  return {
    nav: {
      title: locale === "es" ? "CloudOps Tools" : "CloudOps Tools",
    },
    githubUrl: "https://github.com/jfalava/cloudops-tools",
  };
}
