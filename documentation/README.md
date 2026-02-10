# CloudOps Tools Documentation

Documentation site for CloudOps Tools - AWS cloud operations toolkit with CLI and SDK.

## Built With

This documentation site is powered by **[Fumadocs](https://fumadocs.vercel.app)** - a beautiful, fast, and flexible documentation framework for React applications.

## Routing Structure

| Route         | Description                     |
| ------------- | ------------------------------- |
| `/`           | Landing page with CLI/SDK cards |
| `/docs`       | Redirects to `/docs/cli`        |
| `/docs/cli/*` | CLI documentation               |
| `/docs/sdk/*` | SDK documentation               |

## Development

### Prerequisites

- [Bun](https://bun.sh) 1.0+
- Node.js 18+

### Install Dependencies

```bash
bun install
```

### Start Development Server

```bash
bun run dev
```

The site will be available at `http://localhost:3000`.

### Build for Production

```bash
bun run build
```

### Generate SDK API Documentation

```bash
bun run generate:sdk-api
```

This generates TypeDoc documentation from the SDK source code.

## Adding Documentation

### CLI Documentation

Add MDX files to `content/docs/cli/`:

```mdx
---
title: Your Page Title
description: Brief description for SEO
---

# Your Page Title

Your content here...
```

Update `content/docs/cli/meta.json` to include the new page in navigation:

```json
{
  "title": "CLI",
  "pages": ["index", "installation", "your-new-page", "---Commands---", "commands"]
}
```

### SDK Documentation

Add MDX files to `content/docs/sdk/` and update `content/docs/sdk/meta.json`.

## Deployment

The documentation is deployed to Cloudflare Pages:

```bash
bun run deploy
```

This runs the full pipeline:

1. Type checking
2. Linting
3. SDK API generation
4. Vite build
5. Wrangler deploy

## Credits

- [Fumadocs](https://fumadocs.vercel.app) - Documentation framework
- [TanStack Router](https://tanstack.com/router) - Type-safe routing
- [TanStack Start](https://tanstack.com/start) - Full-stack React framework
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework
- [Lucide React](https://lucide.dev) - Beautiful icons
