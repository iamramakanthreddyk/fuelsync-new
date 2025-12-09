Shared code flow map moved from root (replaced existing placeholder).
Shared code flow map moved here. Original content migrated.
# FuelSync Shared Code Structure & Flow Map

This document explains the structure and flow of shared code in the FuelSync project, helping you find and use existing code efficiently.

----

## 📁 Folder Structure Overview

```
src/
  core/
    enums/         # All enums and their type aliases (UserRoleEnum, FuelTypeEnum, ...)
  types/           # All shared TypeScript types and interfaces (API, DB, etc.)
  lib/             # All shared helper functions (API error handler, payload mappers, ...)
  index.ts         # Central export for all shared code
```

----

## 🔗 Import Flow

- **Enums:**
  ```ts
  import { UserRoleEnum } from '@/core/enums';
  import type { UserRole } from '@/core/enums';
  // or centrally
  import { UserRoleEnum } from '@/index';
  ```
- **Types:**
  ```ts
  import type { Station } from '@/types';
  // or centrally
  import type { Station } from '@/index';
  ```
- **Helpers:**
  ```ts
  import { getApiErrorMessage } from '@/lib';
  // or centrally
  import { getApiErrorMessage } from '@/index';
  ```

----

## 🗺️ Flow Map

1. **Find what you need:**
   - Enums: `src/core/enums/`
   - Types: `src/types/`
   - Helpers: `src/lib/`
2. **Import from the folder's `index.ts` or from `src/index.ts` for convenience.**
3. **If you add new shared code:**
   - Place it in the correct folder.
   - Export it in the folder's `index.ts` and in `src/index.ts`.
   - Update the shared code README.

----

## ✅ Best Practices

- Always check for existing enums, types, or helpers before creating new ones.
- Use the central `src/index.ts` for most imports to keep code clean and discoverable.
- Keep documentation up to date.

----

**Tip:** Use VS Code search (Ctrl+Shift+F) to quickly find shared code.
# FuelSync Shared Code Structure & Flow Map

This document explains the structure and flow of shared code in the FuelSync project, helping you find and use existing code efficiently.

---

## 📁 Folder Structure Overview

```
src/
  core/
    enums/         # All enums and their type aliases (UserRoleEnum, FuelTypeEnum, ...)
  types/           # All shared TypeScript types and interfaces (API, DB, etc.)
  lib/             # All shared helper functions (API error handler, payload mappers, ...)
  index.ts         # Central export for all shared code
```

---

## 🔗 Import Flow

- **Enums:**
  ```ts
  import { UserRoleEnum } from '@/core/enums';
  import type { UserRole } from '@/core/enums';
  // or centrally
  import { UserRoleEnum } from '@/index';
  ```
- **Types:**
  ```ts
  import type { Station } from '@/types';
  // or centrally
  import type { Station } from '@/index';
  ```
- **Helpers:**
  ```ts
  import { getApiErrorMessage } from '@/lib';
  // or centrally
  import { getApiErrorMessage} from '@/index';
  ```

---

## 🗺️ Flow Map

1. **Find what you need:**
   - Enums: `src/core/enums/`
   - Types: `src/types/`
   - Helpers: `src/lib/`
2. **Import from the folder's `index.ts` or from `src/index.ts` for convenience.**
3. **If you add new shared code:**
   - Place it in the correct folder.
   - Export it in the folder's `index.ts` and in `src/index.ts`.
   - Update the shared code README.

---

## ✅ Best Practices
- Always check for existing enums, types, or helpers before creating new ones.
- Use the central `src/index.ts` for most imports to keep code clean and discoverable.
- Keep documentation up to date.

---

**Tip:** Use VS Code search (Ctrl+Shift+F) to quickly find shared code.
