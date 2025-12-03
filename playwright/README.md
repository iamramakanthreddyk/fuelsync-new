Playwright E2E tests

Prerequisites:
- App running locally (default: http://localhost:5173)
- Playwright installed in the project

Install Playwright:

```powershell
npm install -D @playwright/test
npx playwright install
```

Run the test:

```powershell
npx playwright test playwright/tests/role-redirect.spec.ts --project=chromium
```

You can set a custom base URL with `E2E_BASE_URL` environment variable.
