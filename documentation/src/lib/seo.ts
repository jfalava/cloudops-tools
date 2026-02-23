type SeoInput = {
  title: string;
  description: string;
  path: string;
};

const SITE_NAME = "CloudOps Tools";
const SITE_URL = "https://cloudops-tools.jfa.dev";
const DEFAULT_OG_IMAGE = `${SITE_URL}/android-chrome-512x512.png`;
const DEFAULT_OG_IMAGE_ALT = "CloudOps Tools documentation";

const toAbsoluteUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, SITE_URL).toString();
};

export const buildSeoMeta = ({ title, description, path }: SeoInput) => {
  const url = toAbsoluteUrl(path);

  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:image", content: DEFAULT_OG_IMAGE },
    { property: "og:image:alt", content: DEFAULT_OG_IMAGE_ALT },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:url", content: url },
    { name: "twitter:image", content: DEFAULT_OG_IMAGE },
  ];
};

export const buildCanonicalLink = (path: string) => ({
  rel: "canonical",
  href: toAbsoluteUrl(path),
});

export const seoTitle = (pageTitle: string): string => `${pageTitle} | CloudOps Tools Docs`;

export const defaultDocsDescription =
  "CloudOps Tools documentation for the CLI and SDK, including setup, commands, and API usage.";
