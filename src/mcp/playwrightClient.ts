import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { getLogger } from '../utils/logger';
import { BaseMCPClient } from './baseClient';
import { getEnvConfig } from '../utils/env';

const logger = getLogger();

export interface PlaywrightTestResult {
  success: boolean;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number;
  failures?: TestFailure[];
  reportPath?: string;
}

export interface TestFailure {
  test: string;
  error: string;
  stack?: string;
  tracePath?: string;
}

export interface CodegenOptions {
  url: string;
  browser?: 'chromium' | 'firefox' | 'webkit';
  output?: string;
  target?: 'playwright' | 'playwright-test';
}

export interface RunTestOptions {
  testPath?: string;
  project?: string;
  grep?: string;
  grepInvert?: string;
  headed?: boolean;
  debug?: boolean;
  reporter?: string;
  workers?: number;
  retries?: number;
  timeout?: number;
}

/**
 * Playwright MCP Client
 * Communicates with the official Playwright Test MCP server
 * Install: npx @modelcontextprotocol/create-server playwright
 */
export class PlaywrightClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private httpClient: BaseMCPClient | null = null;
  private connected: boolean = false;
  private useHttp: boolean = false;

  constructor() {
    this.client = new Client(
      {
        name: 'agentic-playwright-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );
    logger.info('PlaywrightClient initialized');
    const env = getEnvConfig();
    this.useHttp = env.mcp.transport === 'http';
    if (this.useHttp && env.mcp.baseURL) {
      this.httpClient = new BaseMCPClient({ baseURL: env.mcp.baseURL });
    }
  }

  /**
   * Connect to Playwright MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      if (this.useHttp) {
        // HTTP transport doesn't need a stdio connection; just verify the endpoint
        this.connected = true;
        logger.info('PlaywrightClient configured to use HTTP MCP transport');
        return;
      }

      // Connect to Playwright MCP server via stdio by invoking the official create-server helper
      // This runs: npx @modelcontextprotocol/create-server playwright
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: ['@modelcontextprotocol/create-server', 'playwright'],
      });

      await this.client.connect(this.transport);
      this.connected = true;
      logger.info('Connected to Playwright MCP server (stdio)');
    } catch (error) {
      logger.error('Failed to connect to Playwright MCP server', { error });
      throw error;
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.close();
      this.connected = false;
      logger.info('Disconnected from Playwright MCP server');
    } catch (error) {
      logger.error('Failed to disconnect from Playwright MCP server', { error });
    }
  }

  /**
   * Call a tool via MCP
   */
  private async callTool<T>(toolName: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      if (this.useHttp && this.httpClient) {
        // Call hosted MCP via HTTP
        const resp = await this.httpClient.callMethod<string>(toolName, args);
        if (!resp.success) {
          throw new Error(resp.error || 'MCP HTTP request failed');
        }
        return (resp.data as unknown) as T;
      }

      // Fallback to stdio MCP client
      const result: any = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      return result?.content?.[0]?.text as T;
    } catch (error) {
      logger.error(`MCP tool call failed: ${toolName}`, { error, args });
      throw error;
    }
  }

  /**
   * Health check for Playwright MCP server
   */
  async healthCheck(): Promise<boolean> {
    if (!this.connected) {
      try {
        await this.connect();
      } catch (err) {
        return false;
      }
    }

    try {
      // Try listing tools as a lightweight check
      const tools = await this.client.listTools();
      return Array.isArray(tools.tools);
    } catch (error) {
      logger.warn('Playwright MCP health check failed', { error });
      return false;
    }
  }

  /**
   * Run Playwright tests
   */
  async run(options: RunTestOptions = {}): Promise<PlaywrightTestResult> {
    logger.info('Running Playwright tests via MCP', { options });

    try {
      const result = await this.callTool<string>('playwright_run_tests', {
        testPath: options.testPath,
        project: options.project,
        grep: options.grep,
        headed: options.headed,
        debug: options.debug,
        workers: options.workers?.toString(),
        retries: options.retries?.toString(),
      });

      // Parse result from MCP
      const parsed = JSON.parse(result);
      
      logger.info('Test execution complete', {
        passed: parsed.passed,
        failed: parsed.failed,
        total: parsed.total,
      });

      return {
        success: parsed.failed === 0,
        passed: parsed.passed || 0,
        failed: parsed.failed || 0,
        skipped: parsed.skipped || 0,
        total: parsed.total || 0,
        duration: parsed.duration || 0,
        failures: parsed.failures,
        reportPath: parsed.reportPath,
      };
    } catch (error) {
      logger.error('Test execution failed', { error });
      throw error;
    }
  }

  /**
   * Generate test code using Playwright Codegen
   */
  async codegen(options: CodegenOptions): Promise<string> {
    logger.info('Generating test code via MCP', { url: options.url });

    try {
      const result = await this.callTool<string>('playwright_codegen', {
        url: options.url,
        browser: options.browser,
        output: options.output,
        target: options.target,
      });

      return result;
    } catch (error) {
      logger.error('Codegen failed', { error });
      throw error;
    }
  }

  /**
   * Open trace viewer
   */
  async openTrace(tracePath: string): Promise<void> {
    logger.info('Opening trace viewer via MCP', { tracePath });

    try {
      await this.callTool('playwright_show_trace', { tracePath });
    } catch (error) {
      logger.error('Failed to open trace', { error });
      throw error;
    }
  }

  /**
   * Install Playwright browsers
   */
  async install(browsers?: string[]): Promise<void> {
    logger.info('Installing Playwright browsers via MCP', { browsers });

    try {
      await this.callTool('playwright_install_browsers', {
        browsers: browsers?.join(','),
      });
      logger.info('Browsers installed successfully');
    } catch (error) {
      logger.error('Browser installation failed', { error });
      throw error;
    }
  }

  /**
   * Show HTML report
   */
  async showReport(reportPath?: string): Promise<void> {
    logger.info('Opening HTML report via MCP', { reportPath });

    try {
      await this.callTool('playwright_show_report', { reportPath });
    } catch (error) {
      logger.error('Failed to open report', { error });
      throw error;
    }
  }

  /**
   * List available tools
   */
  async listTools(): Promise<string[]> {
    if (!this.connected) {
      await this.connect();
    }

    const tools = await this.client.listTools();
    return tools.tools.map((t) => t.name);
  }
}

// Singleton instance
let playwrightClientInstance: PlaywrightClient | null = null;

/**
 * Get the Playwright client singleton instance
 */
export function getPlaywrightClient(): PlaywrightClient {
  if (!playwrightClientInstance) {
    playwrightClientInstance = new PlaywrightClient();
  }
  return playwrightClientInstance;
}

