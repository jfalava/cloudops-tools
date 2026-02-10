import { BookOpen } from "lucide-react";

export function Header() {
  return (
    <header className="border-b px-6 py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          <span className="text-lg font-semibold">CloudOps Tools</span>
        </div>
        <a
          href="https://github.com/jfalava/cloudops-tools"
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          GitHub
        </a>
      </div>
    </header>
  );
}
