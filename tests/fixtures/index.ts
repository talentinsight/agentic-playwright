/**
 * Central fixture exports
 * Import from this file to use all fixtures together
 */

import { test as authTest } from './auth';
import { test as dataTest } from './data';
import { mergeTests } from '@playwright/test';

/**
 * Merged test fixture with both auth and data fixtures
 */
export const test = mergeTests(authTest, dataTest);

export { expect } from '@playwright/test';

// Re-export individual fixtures if needed
export * from './auth';
export * from './data';

