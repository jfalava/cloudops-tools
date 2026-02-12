import { Terminal, Code2 } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

function DocCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="group bg-card hover:bg-accent/50 relative overflow-hidden rounded-lg border p-6 text-left shadow-sm transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="bg-primary/10 rounded-md p-3">
          <Icon className="text-primary h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold group-hover:underline">{title}</h2>
          <p className="text-muted-foreground mt-2 text-sm">{description}</p>
        </div>
      </div>
    </a>
  );
}

function QuickLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-primary text-sm hover:underline">
      {children}
    </a>
  );
}

export function Hero() {
  return (
    <main className="flex-1 px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">CloudOps Tools</h1>
        <p className="text-muted-foreground mt-6 text-lg">
          AWS cloud operations toolkit with a powerful CLI and TypeScript SDK for inventory
          management, resource discovery, and automation.
        </p>

        {/* Documentation Cards */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <DocCard
            href="/docs/cli"
            icon={Terminal}
            title="CLI Documentation"
            description="Command-line tools for AWS inventory scanning, resource description, and cloud operations. Get started with installation and command references."
          />
          <DocCard
            href="/docs/sdk"
            icon={Code2}
            title="SDK Documentation"
            description="TypeScript SDK built with Effect for functional AWS operations. Learn about services, operations, error handling, and more."
          />
        </div>

        {/* Quick Links */}
        <div className="mt-12 border-t pt-8">
          <p className="text-muted-foreground text-sm">Quick Links</p>
          <div className="mt-4 flex flex-wrap justify-center gap-4">
            <QuickLink href="/docs/cli/installation">Installation</QuickLink>
            <span className="text-muted-foreground">·</span>
            <QuickLink href="/docs/cli/commands">CLI Commands</QuickLink>
            <span className="text-muted-foreground">·</span>
            <QuickLink href="/docs/sdk/getting-started">SDK Getting Started</QuickLink>
            <span className="text-muted-foreground">·</span>
            <QuickLink href="/docs/sdk/api">API Reference</QuickLink>
          </div>
        </div>
      </div>
    </main>
  );
}
