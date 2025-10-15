import axios, { AxiosInstance, AxiosError } from 'axios';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface MCPClientConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Base MCP Client for protocol communication
 */
export class BaseMCPClient {
  protected client: AxiosInstance;
  protected config: MCPClientConfig;

  constructor(config: MCPClientConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Send a request to the MCP server
   */
  protected async request<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    retryCount: number = 0
  ): Promise<MCPResponse<T>> {
    try {
      logger.debug(`MCP Request: ${method}`, { params });

      const response = await this.client.post<MCPResponse<T>>('/mcp', {
        method,
        params,
      });

      logger.debug(`MCP Response: ${method}`, { success: response.data.success });

      return response.data;
    } catch (error) {
      if (this.shouldRetry(error, retryCount)) {
        logger.warn(`MCP request failed, retrying (${retryCount + 1}/${this.config.retries})`, {
          method,
          error: error instanceof Error ? error.message : String(error),
        });

        await this.delay(this.config.retryDelay! * (retryCount + 1));
        return this.request<T>(method, params, retryCount + 1);
      }

      logger.error(`MCP request failed: ${method}`, {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: this.extractErrorMessage(error),
      };
    }
  }

  /**
   * Check if request should be retried
   */
  protected shouldRetry(error: unknown, retryCount: number): boolean {
    if (retryCount >= this.config.retries!) {
      return false;
    }

    if (axios.isAxiosError(error)) {
      // Retry on network errors or 5xx server errors
      return !error.response || (error.response.status >= 500 && error.response.status < 600);
    }

    return false;
  }

  /**
   * Extract error message from various error types
   */
  protected extractErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; message?: string }>;
      if (axiosError.response?.data) {
        return axiosError.response.data.error || axiosError.response.data.message || axiosError.message;
      }
      return axiosError.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  /**
   * Delay helper for retries
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Health check for the MCP server
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      logger.warn('MCP health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get server info
   */
  async getServerInfo(): Promise<MCPResponse<{ version: string; capabilities: string[] }>> {
    return this.request('server.info');
  }

  /**
   * Public helper to call any MCP method (wraps protected request)
   */
  async callMethod<T = unknown>(method: string, params?: Record<string, unknown>): Promise<MCPResponse<T>> {
    return this.request<T>(method, params);
  }
}

