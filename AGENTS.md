# CloudOps Tools - Agent Development Guide

This document provides essential information for agentic coding agents working in this repository.

## Project Overview

**Architecture**: TypeScript/Node.js monorepo using Bun workspaces with functional programming patterns via the Effect library.
**Structure**: Two main packages - `cli` (command-line interface) and `sdk` (core library).
**Target**: AWS cloud operations and inventory management tool.

## Build, Test & Quality Commands

### Package-Specific Commands

```bash
# CLI Package
bun run cli:lint          # Lint CLI package
bun run cli:typecheck     # Type check CLI package
bun run cli:format        # Format CLI package
bun run cli:check         # Run all quality checks (typecheck + lint + format)

# SDK Package
bun run sdk:lint          # Lint SDK package
bun run sdk:typecheck     # Type check SDK package
bun run sdk:format        # Format SDK package
bun run sdk:check         # Run all quality checks
bun run sdk:test          # Run all tests
bun run sdk:test:coverage # Run tests with coverage
bun run sdk:test:watch    # Watch mode for development
```

### Global Commands

```bash
bun run check:global      # Run all quality checks across packages
bun run format:global     # Format all packages
bun run lint:global       # Lint all packages
bun run typecheck:global  # Type check all packages
```

### Build Commands

```bash
bun run cli:build:all     # Build for all platforms
bun run cli:build:windows # Build Windows x64 binary
bun run cli:build:linux   # Build Linux x64 binary
bun run cli:build:macos   # Build macOS ARM binary
```

### Development Workflow

```bash
bun run check:catalog     # Validate catalog usage across workspaces
bun run check:outdated    # Check for outdated catalog dependencies
```

## Code Style Guidelines

### Import Conventions

- **External libraries**: Standard imports (`import { Effect } from "effect"`)
- **Internal modules**: Use `@/` pattern for workspace-relative imports
- **AWS SDK**: Prefer distilled-aws wrapper over direct AWS SDK imports
- **Sorting**: Imports are automatically sorted by OXFmt
- **No duplicate imports**: Enforced by linting rules

### Formatting Rules (OXFmt)

- **Print width**: 100 characters
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Double quotes only
- **Semicolons**: Required
- **Trailing commas**: All (ES5+ compatible)
- **Automatic sorting**: Package.json scripts and imports

### TypeScript Configuration

- **Strict mode**: Enabled with comprehensive type checking
- **Target**: ESNext with modern features
- **Module resolution**: Bundler mode
- **No implicit any**: Strictly enforced
- **No unchecked indexed access**: Enabled
- **No implicit overrides**: Enabled

### Linting Rules (OXLint + TSGO)

- **Type safety**: No `any`, unsafe assignments, calls, member access, or returns
- **Code complexity**: Max depth 4, max params 5, max statements 40, complexity 12
- **Best practices**: No console (except warn/error), no eval, no debugger
- **Import hygiene**: No duplicates, no unresolved imports
- **Naming**: Variables unused should be prefixed with underscore (`_`)

### Functional Programming Patterns

- **Effect library**: All async operations wrapped in Effect types
- **Pure functions**: Avoid side effects in core logic
- **Layer system**: Use Effect's dependency injection via layers
- **Error handling**: Effect-based error management, not try/catch
- **Generators**: Use `Effect.gen` for sequencing async operations

### AWS Integration Guidelines

- **Credential management**: Use distilled-aws wrapper for pure Effect operations
- **Region handling**: Default to `us-east-1` unless specified
- **Service clients**: Use dependency injection pattern via Effect layers
- **Error handling**: Wrap all AWS calls in Effect.tryPromise

### File Organization

```
sdk/src/
├── services/      # AWS service integrations
├── operations/    # Business logic operations
├── lib/          # Utility functions and helpers
├── types/        # TypeScript type definitions
├── credentials/  # AWS credential management
└── index.ts      # Main exports

cli/src/
├── commands/     # CLI command definitions
├── app.ts        # Main application entry point
└── config/       # CLI configuration
```

### Testing Guidelines

- **Framework**: Bun's built-in test runner
- **Test files**: Use `.test.ts` or `.spec.ts` extensions
- **Location**: Place tests alongside source files or in dedicated test directories
- **Coverage**: Use `bun test --coverage` for coverage reports
- **Watch mode**: Use `bun test --watch` during development

### Dependency Management

- **Workspace catalog**: All shared dependencies must use `"catalog:"` version
- **Catalog validation**: Run `bun run check:catalog` to ensure compliance
- **Bun workspaces**: Use workspace references (`"workspace:*"`) for internal packages
- **Type safety**: Strict TypeScript with TSGO compiler for enhanced checks

### Error Handling Patterns

```typescript
// Preferred: Effect-based error handling
const result = Effect.gen(function* (_) {
  const data = yield* _(Effect.tryPromise(() => awsCall()));
  return processData(data);
});

// Avoid: Traditional try/catch
try {
  const data = await awsCall();
  return processData(data);
} catch (error) {
  // Handle error
}
```

### CLI Development Patterns

- Use `@effect/cli` for command definitions
- Options and arguments should have proper validation
- Commands should return Effects for execution
- Use descriptive help text and examples
- Support both short and long option aliases

## Quality Gates

Before committing changes, ensure all quality checks pass:

```bash
bun run check:global  # Comprehensive quality check
```

This runs type checking, linting, and formatting across all packages. Any failures must be resolved before the code is considered complete.

## Common Workflows

1. **Adding new functionality**:
   - Implement in SDK package first
   - Add tests using Bun test runner
   - Create CLI commands if needed
   - Run quality checks before committing

2. **Updating dependencies**:
   - Update root catalog entries
   - Run `bun run check:outdated` to verify
   - Update workspace packages to use `"catalog:"` versions

3. **Code changes**:
   - Make changes following style guidelines
   - Run `bun run format:global` to auto-format
   - Run `bun run check:global` to validate quality

4. **Building for distribution**:
   - Use `bun run cli:build:all` for cross-platform binaries
   - Version is injected via `BUILD_VERSION` environment variable
