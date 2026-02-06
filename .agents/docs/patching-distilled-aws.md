Patching distilled-aws in CloudOps Tools

Context
- The distilled-aws worktree is reference-only; fixes must live in the CloudOps SDK.
- Some AWS Query services (notably RDS and ElastiCache) were failing with:
  "InvalidAction: Could not find operation ...Message for version 2014-10-31".

Approach
- Implement AWS SDK v3 fallbacks in the CloudOps SDK to bypass the distilled-aws protocol bug.
- Keep the fallback implementation Effect-first and safe to retain long-term.

Implementation
- Added a patch module:
  - sdk/src/patches/aws-sdk.ts
  - sdk/src/patches/index.ts
- The patch uses AWS SDK v3 clients wrapped in Effect.tryPromise:
  - describeRdsInstances(region)
  - getRdsInstance(region, id)
  - describeElastiCacheClusters(region)
- Errors are normalized in tryPromise with a typed catch to preserve the original error message.

Wiring
- DatabaseService now uses the patch functions for:
  - describeRDS
  - getRDSDetails
  - describeElastiCache
- distilled-aws is still used for other services.

Why this is acceptable
- The AWS SDK v3 implementation is correct and stable.
- It can remain even after distilled-aws fixes the Query protocol action naming.
- This isolates the workaround to the minimal affected services.

Testing
- Run:
  - bun run --filter @cloudops-tools/sdk typecheck
  - bun run --filter @cloudops-tools/cli typecheck
- Example scan:
  - bun cli/src/app.ts --init --region eu-south-2 --skip-global --debug

Notes
- If more Query services hit the same InvalidAction issue, add them to sdk/src/patches/aws-sdk.ts.
- Use the same Effect.tryPromise pattern to keep errors visible under --debug.
