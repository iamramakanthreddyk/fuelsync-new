import { test, expect } from '@playwright/test';

// These tests assume the app is running locally at http://localhost:5173
const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';

test.describe('Role-based redirects & auth-expiry', () => {
  test('Owner is redirected to /owner/dashboard after login', async ({ page }) => {
    // Simulate a logged-in owner by setting localStorage token and user
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.setItem('fuelsync_token', 'fake-token-owner');
      localStorage.setItem('fuelsync_user', JSON.stringify({ id: 1, role: 'owner', stations: [] }));
    });

    await page.goto(BASE + '/');
    // Navigate to the root which should redirect based on role
    await page.waitForURL('**/owner/dashboard', { timeout: 5000 });
    expect(page.url()).toContain('/owner/dashboard');
  });

  test('Superadmin is redirected to /superadmin/users after login', async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.setItem('fuelsync_token', 'fake-token-superadmin');
      localStorage.setItem('fuelsync_user', JSON.stringify({ id: 2, role: 'superadmin' }));
    });

    await page.goto(BASE + '/');
    await page.waitForURL('**/superadmin/users', { timeout: 5000 });
    expect(page.url()).toContain('/superadmin/users');
  });

  test('Auth expiry clears user and redirects to /login', async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => {
      localStorage.setItem('fuelsync_token', 'fake-token-owner');
      localStorage.setItem('fuelsync_user', JSON.stringify({ id: 1, role: 'owner' }));
    });

    // Open app and confirm we're on owner dashboard
    await page.goto(BASE + '/');
    await page.waitForURL('**/owner/dashboard', { timeout: 5000 });

    // Simulate token expiry by removing token and dispatching storage event
    await page.evaluate(() => {
      localStorage.removeItem('fuelsync_token');
      window.dispatchEvent(new StorageEvent('storage', { key: 'fuelsync_token', newValue: null } as any));
    });

    // App's auth provider should react and redirect to /login
    await page.waitForURL('**/login', { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });
});
