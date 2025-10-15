import { test as base, Page } from '@playwright/test';
import { getEnvConfig } from '../../src/utils/env';

export interface AuthUser {
  username: string;
  password: string;
  role: 'admin' | 'user' | 'guest';
}

/**
 * Authentication fixture
 * Provides authenticated page instances for different user roles
 */
export const test = base.extend<{
  authenticatedPage: Page;
  adminPage: Page;
  userPage: Page;
  guestPage: Page;
}>({
  /**
   * Generic authenticated page
   */
  authenticatedPage: async ({ page }, use) => {
    const config = getEnvConfig();
    const username = config.testEnv.username || 'test@example.com';
    const password = config.testEnv.password || 'password';

    await login(page, username, password);
    await use(page);
    await logout(page);
  },

  /**
   * Admin user page
   */
  adminPage: async ({ page }, use) => {
    const config = getEnvConfig();
    const adminUser = process.env.ADMIN_USERNAME || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin-password';

    await login(page, adminUser, adminPassword);
    await use(page);
    await logout(page);
  },

  /**
   * Regular user page
   */
  userPage: async ({ page }, use) => {
    const config = getEnvConfig();
    const username = config.testEnv.username || 'user@example.com';
    const password = config.testEnv.password || 'user-password';

    await login(page, username, password);
    await use(page);
    await logout(page);
  },

  /**
   * Guest user page (no authentication)
   */
  guestPage: async ({ page }, use) => {
    // No authentication needed
    await use(page);
  },
});

/**
 * Login helper function
 */
async function login(page: Page, username: string, password: string): Promise<void> {
  const config = getEnvConfig();
  const baseURL = config.testEnv.baseUrl;

  // Navigate to login page
  await page.goto(`${baseURL}/login`);

  // Fill in credentials
  // Using semantic selectors
  await page.getByLabel(/username|email/i).fill(username);
  await page.getByLabel(/password/i).fill(password);

  // Click login button
  await page.getByRole('button', { name: /log in|sign in|submit/i }).click();

  // Wait for navigation to complete
  await page.waitForURL(/dashboard|home/, { timeout: 10000 }).catch(() => {
    // If URL doesn't change, check for success indicator
    return page.waitForSelector('[data-testid="user-menu"], .user-profile', { timeout: 5000 });
  });
}

/**
 * Logout helper function
 */
async function logout(page: Page): Promise<void> {
  try {
    // Try to find and click logout
    const logoutButton = page.getByRole('button', { name: /log out|sign out/i });
    if (await logoutButton.isVisible({ timeout: 2000 })) {
      await logoutButton.click();
    }
  } catch {
    // If logout fails, just clear storage
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  }
}

/**
 * Get authentication token (if using token-based auth)
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    return localStorage.getItem('authToken') || 
           sessionStorage.getItem('authToken') || 
           null;
  });
}

/**
 * Set authentication token
 */
export async function setAuthToken(page: Page, token: string): Promise<void> {
  await page.evaluate((tk) => {
    localStorage.setItem('authToken', tk);
  }, token);
}

/**
 * Clear authentication
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

export { expect } from '@playwright/test';

