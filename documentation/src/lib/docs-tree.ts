import type { Root } from "fumadocs-core/page-tree";

export const docsTree: Root = {
  name: "Documentation",
  children: [
    {
      type: "folder",
      name: "CLI",
      description: "Command-line instructions",
      root: true,
      index: {
        type: "page",
        name: "Getting Started",
        url: "/docs",
      },
      children: [
        {
          type: "page",
          name: "Installation",
          url: "/docs/installation",
        },
        {
          type: "page",
          name: "Build CLI Binary",
          url: "/docs/build-cli",
        },
        {
          type: "page",
          name: "Configuration",
          url: "/docs/configuration",
        },
        {
          type: "separator",
          name: "Guides",
        },
        {
          type: "page",
          name: "Choose Command",
          url: "/docs/choose-command",
        },
        {
          type: "page",
          name: "Scan Profiles",
          url: "/docs/scan-profiles",
        },
        {
          type: "page",
          name: "Troubleshooting",
          url: "/docs/troubleshooting",
        },
        {
          type: "separator",
          name: "Commands",
        },
        {
          type: "page",
          name: "Overview",
          url: "/docs/commands",
        },
        {
          type: "page",
          name: "init",
          url: "/docs/commands/init",
        },
        {
          type: "page",
          name: "describe",
          url: "/docs/commands/describe",
        },
        {
          type: "page",
          name: "setup-totp",
          url: "/docs/commands/setup-totp",
        },
        {
          type: "page",
          name: "use-letme",
          url: "/docs/commands/use-letme",
        },
        {
          type: "page",
          name: "config",
          url: "/docs/commands/config",
        },
      ],
    },
    {
      type: "folder",
      name: "SDK",
      description: "Build on top of the SDK",
      root: true,
      index: {
        type: "page",
        name: "Overview",
        url: "/docs/sdk",
      },
      children: [
        {
          type: "page",
          name: "Getting Started",
          url: "/docs/sdk/getting-started",
        },
        {
          type: "page",
          name: "Error Model",
          url: "/docs/sdk/error-model",
        },
        {
          type: "page",
          name: "Layers and Runtime",
          url: "/docs/sdk/layers-and-runtime",
        },
        {
          type: "page",
          name: "Operations",
          url: "/docs/sdk/operations",
        },
        {
          type: "page",
          name: "Examples",
          url: "/docs/sdk/examples",
        },
        {
          type: "page",
          name: "Services: Compute & Storage",
          url: "/docs/sdk/services-compute-storage",
        },
        {
          type: "page",
          name: "Services: Data & Networking",
          url: "/docs/sdk/services-data-networking",
        },
        {
          type: "page",
          name: "Services: Security & Platform",
          url: "/docs/sdk/services-security-platform",
        },
        {
          type: "page",
          name: "Utilities",
          url: "/docs/sdk/utilities",
        },
        {
          type: "page",
          name: "Reference Map",
          url: "/docs/sdk/reference-map",
        },
        {
          type: "separator",
          name: "API",
        },
        {
          type: "page",
          name: "Overview",
          url: "/docs/sdk/api",
        },
        {
          type: "page",
          name: "Core",
          url: "/docs/sdk/api/core",
        },
        {
          type: "page",
          name: "Operations",
          url: "/docs/sdk/api/operations",
        },
        {
          type: "page",
          name: "Services",
          url: "/docs/sdk/api/services",
        },
        {
          type: "page",
          name: "Utilities",
          url: "/docs/sdk/api/lib",
        },
        {
          type: "page",
          name: "Types",
          url: "/docs/sdk/api/types",
        },
        {
          type: "page",
          name: "Credentials",
          url: "/docs/sdk/api/credentials",
        },
      ],
    },
  ],
};
