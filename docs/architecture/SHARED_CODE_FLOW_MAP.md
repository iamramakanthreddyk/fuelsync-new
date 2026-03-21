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
  import { getApiErrorMessage } from '@/index';
  ```

---

## 🗺️ Flow Map

1. **Find what you need:**
  SHARED_CODE_FLOW_MAP.md moved to `docs/architecture/SHARED_CODE_FLOW_MAP.md` to consolidate documentation.
  Please use the `docs/architecture/` folder for shared-code guidance.
   - Helpers: `src/lib/`
