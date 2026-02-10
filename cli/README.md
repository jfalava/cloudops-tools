# @cloudops-tools/cli

`@cloudops-tools/cli` is the user-facing command-line interface for CloudOps Tools.

It is a thin wrapper around `@cloudops-tools/sdk`: the CLI parses commands/options, invokes SDK
operations, and presents results in a terminal-friendly interface.

For usage, setup, and command/API docs, start at the documentation website:

- https://cloudops-tools.jfa.dev/docs

## CLI package manager install

Install globally with:

```bash
npm install -g @cloudops-tools/cli # or use bun/pnpm/yarn
```

The package installs a small launcher and downloads the native binary from GitHub Releases for:

- Linux x64 (`cloudops-tools-linux-x64`)
- Windows x64 (`cloudops-tools-windows-x64.exe`)
- macOS arm64 (`cloudops-tools-macos-arm64`)
