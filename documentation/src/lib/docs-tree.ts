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
        url: "/docs/cli",
      },
      children: [
        {
          type: "page",
          name: "Installation",
          url: "/docs/cli/installation",
        },
        {
          type: "page",
          name: "Build CLI Binary",
          url: "/docs/cli/build-cli",
        },
        {
          type: "page",
          name: "Configuration",
          url: "/docs/cli/configuration",
        },
        {
          type: "separator",
          name: "Guides",
        },
        {
          type: "page",
          name: "Choose Command",
          url: "/docs/cli/choose-command",
        },
        {
          type: "page",
          name: "Scan Profiles",
          url: "/docs/cli/scan-profiles",
        },
        {
          type: "page",
          name: "Exit Codes",
          url: "/docs/cli/exit-codes",
        },
        {
          type: "page",
          name: "Troubleshooting",
          url: "/docs/cli/troubleshooting",
        },
        {
          type: "separator",
          name: "Commands",
        },
        {
          type: "page",
          name: "Overview",
          url: "/docs/cli/commands",
        },
        {
          type: "page",
          name: "init",
          url: "/docs/cli/commands/init",
        },
        {
          type: "page",
          name: "describe",
          url: "/docs/cli/commands/describe",
        },
        {
          type: "page",
          name: "use-letme",
          url: "/docs/cli/commands/use-letme",
        },
        {
          type: "page",
          name: "config",
          url: "/docs/cli/commands/config",
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
