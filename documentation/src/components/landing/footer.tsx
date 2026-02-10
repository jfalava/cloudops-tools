import projectPackage from "../../../package.json";
const VERSION = String(projectPackage.version);

/**
 * Footer component displaying app information and links.
 * Shows version, year, and GitHub repository link.
 *
 * @returns Footer element with app metadata
 */
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border mt-auto w-full border-t select-none">
      <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-4 md:py-6">
        <div className="border-border grid place-items-center border-r py-6 pr-3">
          <div className="grid place-items-center">
            <span className="flex items-center font-semibold tracking-tight">CloudOps Tools</span>
            <span className="-space-x-1 font-mono text-xs tracking-tight">
              Yet another AWS tool by <span className="font-bold">JFA</span>
            </span>
          </div>
          <span className="mt-2 ml-px font-mono text-xs opacity-85">
            v{VERSION} | {currentYear}
          </span>
        </div>
        <div className="ml-3 grid place-items-start gap-2">
          <a
            href="https://fumadocs.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-0.5 flex items-center gap-2 text-sm transition-colors hover:underline"
          >
            <svg width="80" height="80" viewBox="0 0 180 180" className="size-5 in-[.uwu]:hidden">
              <circle
                cx="90"
                cy="90"
                r="89"
                fill="url(#_R_4ir5ulb_-iconGradient)"
                stroke="var(--color-fd-primary)"
                stroke-width="1"
              ></circle>
              <defs>
                <linearGradient id="_R_4ir5ulb_-iconGradient" gradientTransform="rotate(45)">
                  <stop offset="45%" stop-color="var(--color-fd-background)"></stop>
                  <stop offset="100%" stop-color="var(--color-fd-primary)"></stop>
                </linearGradient>
              </defs>
            </svg>
            Made with Fumadocs
          </a>
          <a
            href="https://github.com/jfalava/cloudops-tools/tree/main/documentation"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm transition-colors hover:underline"
            aria-label="View source code on GitHub"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"
              />
            </svg>
            <span>Source code</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
