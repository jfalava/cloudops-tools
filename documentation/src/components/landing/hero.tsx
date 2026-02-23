import { Terminal, Code2 } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import type { Locale } from "@/lib/i18n";
import { localizePath } from "@/lib/i18n";

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

export function Hero({ locale = "en" }: { locale?: Locale }) {
  const copy =
    locale === "es"
      ? {
          title: "CloudOps Tools",
          description:
            "Kit de herramientas de operaciones en AWS con un CLI potente y un SDK en TypeScript para inventario, descubrimiento de recursos y automatización.",
          cliTitle: "Documentación del CLI",
          cliDescription:
            "Herramientas de línea de comandos para inventario de AWS, descripción de recursos y operaciones cloud. Empieza con instalación y referencia de comandos.",
          sdkTitle: "Documentación del SDK",
          sdkDescription:
            "SDK de TypeScript construido con Effect para operaciones funcionales en AWS. Aprende sobre servicios, operaciones, manejo de errores y más.",
          quickLinks: "Enlaces rápidos",
          installation: "Instalación",
          cliCommands: "Comandos CLI",
          sdkGettingStarted: "SDK: Primeros pasos",
          apiReference: "Referencia API",
        }
      : {
          title: "CloudOps Tools",
          description:
            "AWS cloud operations toolkit with a powerful CLI and TypeScript SDK for inventory management, resource discovery, and automation.",
          cliTitle: "CLI Documentation",
          cliDescription:
            "Command-line tools for AWS inventory scanning, resource description, and cloud operations. Get started with installation and command references.",
          sdkTitle: "SDK Documentation",
          sdkDescription:
            "TypeScript SDK built with Effect for functional AWS operations. Learn about services, operations, error handling, and more.",
          quickLinks: "Quick Links",
          installation: "Installation",
          cliCommands: "CLI Commands",
          sdkGettingStarted: "SDK Getting Started",
          apiReference: "API Reference",
        };

  return (
    <main className="flex-1 px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{copy.title}</h1>
        <p className="text-muted-foreground mt-6 text-lg">{copy.description}</p>

        {/* Documentation Cards */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <DocCard
            href={localizePath("/docs/cli", locale)}
            icon={Terminal}
            title={copy.cliTitle}
            description={copy.cliDescription}
          />
          <DocCard
            href={localizePath("/docs/sdk", locale)}
            icon={Code2}
            title={copy.sdkTitle}
            description={copy.sdkDescription}
          />
        </div>

        {/* Quick Links */}
        <div className="mt-12 border-t pt-8">
          <p className="text-muted-foreground text-sm">{copy.quickLinks}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-4">
            <QuickLink href={localizePath("/docs/cli/installation", locale)}>
              {copy.installation}
            </QuickLink>
            <span className="text-muted-foreground">·</span>
            <QuickLink href={localizePath("/docs/cli/commands", locale)}>{copy.cliCommands}</QuickLink>
            <span className="text-muted-foreground">·</span>
            <QuickLink href={localizePath("/docs/sdk/getting-started", locale)}>
              {copy.sdkGettingStarted}
            </QuickLink>
            <span className="text-muted-foreground">·</span>
            <QuickLink href={localizePath("/docs/sdk/api", locale)}>{copy.apiReference}</QuickLink>
          </div>
        </div>
      </div>
    </main>
  );
}
