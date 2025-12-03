# Shared Code Reference

This folder contains shared enums, types, and helpers for the FuelSync project. Use these to avoid duplication and ensure consistency across the codebase.

## How to Use
- **Always search here before creating a new enum, type, or helper.**
- Import from the relevant `index.ts` for predictable paths.
- If you add something new, update this README and the index file.

## Available Modules

### Enums (`core/enums`)
- `UserRoleEnum`, `FuelTypeEnum`, ...
- Import type aliases: `import type { UserRole } from '@/core/enums'`

### Types (`types/`)
- API response types, database models, etc.
- Example: `import type { Station } from '@/types/api'`

### Helpers (`lib/`)
- API error handler: `getApiErrorMessage`
- Payload mappers: `mapReadingFormToPayload`, `toNumber`

## Adding New Shared Code
1. Add your enum/type/helper in the appropriate folder.
2. Export it from the folder's `index.ts`.
3. Add a short description and usage example here.

## Example Usage
```ts
import { getApiErrorMessage } from '@/lib/apiErrorHandler';
import type { UserRole } from '@/core/enums';
```

---

**Tip:** Use VS Code search (Ctrl+Shift+F) to find existing shared code quickly.
