# CloudOps Tools

This repository is a monorepo that hosts:

- `sdk` - the `@cloudops-tools/sdk` package
- `cli` - the `cloudops-tools` command-line application
- `documentation` - the documentation website

For usage, setup, and command/API docs, start at the documentation website:

- https://cloudops-tools.jfa.dev

## CLI package manager install

Install globally with:

```bash
npm install -g @cloudops-tools/cli # or use bun/pnpm/yarn
```

The package installs a small launcher and downloads the native binary from GitHub Releases for:

- Linux x64 (`cloudops-tools-linux-x64`)
- Windows x64 (`cloudops-tools-windows-x64.exe`)
- macOS arm64 (`cloudops-tools-macos-arm64`)
