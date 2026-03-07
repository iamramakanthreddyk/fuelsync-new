# Consolidated Documentation Index

This consolidated index groups and links the most important documentation files in the repository so you can find things faster.

## Core Architecture & Design
- [ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md) — high-level system overview.
- [ARCHITECTURE_READINGS_TRANSACTIONS.md](ARCHITECTURE_READINGS_TRANSACTIONS.md) — design for readings & transactions.
- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) — implementation notes and roadmap.

## API & Backend
- [API_REVIEW_AND_OPTIMIZATION.md](API_REVIEW_AND_OPTIMIZATION.md)
- [API_AUDIT_QUICK_SUMMARY.md](API_AUDIT_QUICK_SUMMARY.md)
- [API_AUDIT_REPORT_INDEX.md](API_AUDIT_REPORT_INDEX.md)
- [API_CONSOLIDATION_ACTION_PLAN.md](API_CONSOLIDATION_ACTION_PLAN.md)
- [API_DEDUP_QUICK_REF.md](API_DEDUP_QUICK_REF.md)

## Deployment & CI/CD
- [DEPLOYMENT_SETUP_GUIDE.md](DEPLOYMENT_SETUP_GUIDE.md)
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
- [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)
- [DEPLOYMENT_RAILWAY_VERCEL.md](DEPLOYMENT_RAILWAY_VERCEL.md)
- [DEPLOY_NOW.md](DEPLOY_NOW.md)

## Daily Operations & Settlements
- [DAILY_SETTLEMENT_INDEX.md](DAILY_SETTLEMENT_INDEX.md)
- [DAILY_SETTLEMENT_FLOWCHART.md](DAILY_SETTLEMENT_FLOWCHART.md)
- [DAILY_SETTLEMENT_IMPLEMENTATION_COMPLETE.md](DAILY_SETTLEMENT_IMPLEMENTATION_COMPLETE.md)
- [DAILY_SETTLEMENT_QUICK_GUIDE.md](DAILY_SETTLEMENT_QUICK_GUIDE.md)

## Audit, Logging & Monitoring
- [AUDIT_LOGGING_ARCHITECTURE.md](AUDIT_LOGGING_ARCHITECTURE.md)
- [AUDIT_LOGGING_INTEGRATION_COMPLETE.md](AUDIT_LOGGING_INTEGRATION_COMPLETE.md)
- [AUDIT_LOGGING_QUICK_REFERENCE.md](AUDIT_LOGGING_QUICK_REFERENCE.md)

## Features & Fixes (quick lookup)
- [FUEL_PRICES_FIX.md](FUEL_PRICES_FIX.md)
- [DUPLICATE_VALIDATION_FIX.md](DUPLICATE_VALIDATION_FIX.md)
- [FUEL_BASED_QUANTITY_FIX.md](FUEL_BASED_QUANTITY_FIX.md)
- [PAYMENT_ALLOCATION_FIX.md](PAYMENT_ALLOCATION_FIX.md)

## Product / UX / Owner Guides
- [OWNER_UI_DOCUMENTATION.md](OWNER_UI_DOCUMENTATION.md)
- [MOBILE_DESKTOP_EXPANSION.md](MOBILE_DESKTOP_EXPANSION.md)
- [DASHBOARD_REFACTORING_SUMMARY.md](DASHBOARD_REFACTORING_SUMMARY.md)

## Migration & Database
- [DATABASE_MIGRATION_STATUS.md](DATABASE_MIGRATION_STATUS.md)
- [BACKEND_SHORTFALL_DATE_ENHANCEMENT.md](BACKEND_SHORTFALL_DATE_ENHANCEMENT.md)

## Checklists & Implementation Status
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)
- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)

## Misc / Utilities
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [components.json](components.json)
- [package.json](package.json)

---

Next steps (suggested):
- Move old/duplicated or low-value docs into `docs/archive/` and keep this index as the primary discovery source.
- Update [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) to link to this consolidated index.
- Optionally add short summaries (1-2 lines) for each linked file.

If you want, I can now: (A) update `DOCUMENTATION_INDEX.md` to point to this file, (B) create `docs/archive/` and move selected files, or (C) run `npx tsc --noEmit` + `npm run lint -- --fix` to validate after doc moves. Which should I do next?