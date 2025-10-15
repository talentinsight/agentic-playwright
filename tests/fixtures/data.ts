import { test as base } from '@playwright/test';
import axios, { AxiosInstance } from 'axios';
import { getEnvConfig } from '../../src/utils/env';

export interface TestData {
  id: string;
  [key: string]: unknown;
}

/**
 * Data fixture
 * Provides test data setup and cleanup
 */
export const test = base.extend<{
  apiClient: AxiosInstance;
  testData: TestData;
  cleanupData: () => Promise<void>;
}>({
  /**
   * API client for data setup/teardown
   */
  apiClient: async ({}, use) => {
    const config = getEnvConfig();
    const baseURL = config.testEnv.baseUrl;

    const client = axios.create({
      baseURL: `${baseURL}/api`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    await use(client);
  },

  /**
   * Test data fixture with automatic cleanup
   */
  testData: async ({ apiClient }, use) => {
    const testData: TestData = {
      id: `test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };

    // Mark apiClient as used to satisfy TypeScript when linters/builders check for unused variables
    void apiClient?.defaults;
    await use(testData);

    // Cleanup after test
    // This would typically delete test data via API
  },

  /**
   * Cleanup function
   */
  cleanupData: async ({}, use) => {
    const dataToCleanup: string[] = [];

    const cleanup = async () => {
      // Implement cleanup logic
      for (const id of dataToCleanup) {
        // Delete data via API
        console.log(`Cleaning up data: ${id}`);
      }
    };

    await use(cleanup);
    await cleanup();
  },
});

/**
 * Test data builders
 */

export interface UserData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

export function buildUser(overrides?: Partial<UserData>): UserData {
  const timestamp = Date.now();
  return {
    username: `testuser${timestamp}`,
    email: `test${timestamp}@example.com`,
    password: 'TestPass123!',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    ...overrides,
  };
}

export interface ProductData {
  name: string;
  description: string;
  price: number;
  sku: string;
  inStock?: boolean;
}

export function buildProduct(overrides?: Partial<ProductData>): ProductData {
  const timestamp = Date.now();
  return {
    name: `Test Product ${timestamp}`,
    description: 'A test product',
    price: 99.99,
    sku: `SKU-${timestamp}`,
    inStock: true,
    ...overrides,
  };
}

export interface OrderData {
  userId: string;
  items: Array<{ productId: string; quantity: number }>;
  total: number;
  status?: string;
}

export function buildOrder(overrides?: Partial<OrderData>): OrderData {
  return {
    userId: 'test-user-id',
    items: [{ productId: 'test-product-id', quantity: 1 }],
    total: 99.99,
    status: 'pending',
    ...overrides,
  };
}

/**
 * Database seeding helper (if direct DB access is available)
 */
export class DataSeeder {
  private apiClient: AxiosInstance;

  constructor(apiClient: AxiosInstance) {
    this.apiClient = apiClient;
  }

  async seedUser(userData: UserData): Promise<{ id: string }> {
    const response = await this.apiClient.post('/users', userData);
    return { id: response.data.id };
  }

  async seedProduct(productData: ProductData): Promise<{ id: string }> {
    const response = await this.apiClient.post('/products', productData);
    return { id: response.data.id };
  }

  async seedOrder(orderData: OrderData): Promise<{ id: string }> {
    const response = await this.apiClient.post('/orders', orderData);
    return { id: response.data.id };
  }

  async cleanup(resourceType: string, id: string): Promise<void> {
    try {
      await this.apiClient.delete(`/${resourceType}/${id}`);
    } catch (error) {
      console.warn(`Failed to cleanup ${resourceType} ${id}:`, error);
    }
  }
}

export { expect } from '@playwright/test';

