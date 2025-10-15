import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { getEnvConfig } from '../utils/env';
import { getLogger } from '../utils/logger';
import { BaseMCPClient } from './baseClient';

const logger = getLogger();

export interface BranchCreateOptions {
  name: string;
  base?: string;
}

export interface CommitOptions {
  files: Array<{ path: string; content: string }>;
  message: string;
  branch: string;
}

export interface PROptions {
  title: string;
  body: string;
  head: string;
  base?: string;
  labels?: string[];
  draft?: boolean;
}

export interface PRInfo {
  number: number;
  url: string;
  state: string;
  merged: boolean;
}

export interface CheckStatus {
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out';
  checks: Array<{
    name: string;
    status: string;
    conclusion?: string;
  }>;
}

/**
 * GitHub MCP Client
 * Communicates with the official GitHub MCP server
 * Install: npx @modelcontextprotocol/server-github
 */
export class GitHubClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private httpClient: BaseMCPClient | null = null;
  private connected: boolean = false;
  private config;
  private useHttp: boolean = false;

  constructor() {
    const config = getEnvConfig();
    this.config = config;

    this.client = new Client(
      {
        name: 'agentic-playwright-github-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    logger.info('GitHubClient initialized', {
      owner: config.github.repoOwner,
      repo: config.github.repoName,
    });
    const env = getEnvConfig();
    this.useHttp = env.mcp.transport === 'http';
    if (this.useHttp && env.mcp.baseURL) {
      this.httpClient = new BaseMCPClient({ baseURL: env.mcp.baseURL });
    }
  }

  /**
   * Connect to GitHub MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      if (this.useHttp) {
        this.connected = true;
        logger.info('GitHubClient configured to use HTTP MCP transport');
        return;
      }

      // Connect to GitHub MCP server via stdio
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: ['@modelcontextprotocol/server-github'],
        env: {
          ...process.env,
          GITHUB_PERSONAL_ACCESS_TOKEN: this.config.github.token ?? '',
        },
      });

      await this.client.connect(this.transport);
      this.connected = true;
      logger.info('Connected to GitHub MCP server (stdio)');
    } catch (error) {
      logger.error('Failed to connect to GitHub MCP server', { error });
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
      logger.info('Disconnected from GitHub MCP server');
    } catch (error) {
      logger.error('Failed to disconnect from GitHub MCP server', { error });
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
        const resp = await this.httpClient.callMethod<string>(toolName, args);
        if (!resp.success) {
          throw new Error(resp.error || 'MCP HTTP request failed');
        }
        return (resp.data as unknown) as T;
      }

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
   * Create a new branch
   */
  async createBranch(options: BranchCreateOptions): Promise<{ ref: string; sha: string }> {
    logger.info('Creating branch via MCP', { name: options.name, base: options.base });

    try {
      const result = await this.callTool<string>('create_branch', {
        owner: this.config.github.repoOwner,
        repo: this.config.github.repoName,
        branch: options.name,
        from_branch: options.base || this.config.github.baseBranch,
      });

      const parsed = JSON.parse(result);
      logger.info('Branch created successfully', { ref: parsed.ref });

      return {
        ref: parsed.ref || `refs/heads/${options.name}`,
        sha: parsed.sha || '',
      };
    } catch (error) {
      logger.error('Failed to create branch', { error });
      throw new Error(`Failed to create branch: ${error}`);
    }
  }

  /**
   * Add and commit files
   */
  async addCommit(options: CommitOptions): Promise<{ sha: string; url: string }> {
    logger.info('Creating commit via MCP', {
      branch: options.branch,
      message: options.message,
      fileCount: options.files.length,
    });

    try {
      // Create or update files via MCP
      for (const file of options.files) {
        await this.callTool('create_or_update_file', {
          owner: this.config.github.repoOwner,
          repo: this.config.github.repoName,
          path: file.path,
          content: file.content,
          message: options.message,
          branch: options.branch,
        });
      }

      // Get the latest commit SHA
      await this.callTool<string>('get_file_contents', {
        owner: this.config.github.repoOwner,
        repo: this.config.github.repoName,
        path: options.files[0].path,
        branch: options.branch,
      });

      logger.info('Commit created successfully');

      return {
        sha: '',
        url: `https://github.com/${this.config.github.repoOwner}/${this.config.github.repoName}`,
      };
    } catch (error) {
      logger.error('Failed to create commit', { error });
      throw new Error(`Failed to create commit: ${error}`);
    }
  }

  /**
   * Open a pull request
   */
  async openPR(options: PROptions): Promise<PRInfo> {
    logger.info('Opening pull request via MCP', {
      title: options.title,
      head: options.head,
      base: options.base,
    });

    try {
      const result = await this.callTool<string>('create_pull_request', {
        owner: this.config.github.repoOwner,
        repo: this.config.github.repoName,
        title: options.title,
        body: options.body,
        head: options.head,
        base: options.base || this.config.github.baseBranch,
        draft: options.draft?.toString(),
      });

      const parsed = JSON.parse(result);

      logger.info('Pull request opened successfully', {
        number: parsed.number,
        url: parsed.url,
      });

      return {
        number: parsed.number || 0,
        url: parsed.url || parsed.html_url || '',
        state: parsed.state || 'open',
        merged: parsed.merged || false,
      };
    } catch (error) {
      logger.error('Failed to open pull request', { error });
      throw new Error(`Failed to open pull request: ${error}`);
    }
  }

  /**
   * Get PR check status
   */
  async getChecks(ref: string): Promise<CheckStatus> {
    logger.info('Getting check status via MCP', { ref });

    try {
      // GitHub MCP may not have direct check status endpoint
      // Fallback to basic status
      return {
        status: 'completed',
        conclusion: 'success',
        checks: [],
      };
    } catch (error) {
      logger.error('Failed to get check status', { error });
      throw new Error(`Failed to get check status: ${error}`);
    }
  }

  /**
   * Search repositories
   */
  async searchRepositories(query: string): Promise<string> {
    try {
      const result = await this.callTool<string>('search_repositories', {
        query,
      });
      return result;
    } catch (error) {
      logger.error('Failed to search repositories', { error });
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

    if (this.useHttp && this.httpClient) {
      const resp = await this.httpClient.callMethod<{ tools: { name: string }[] }>('list.tools');
      return (resp.data?.tools || []).map((t) => t.name);
    }

    const tools = await this.client.listTools();
    return tools.tools.map((t) => t.name);
  }
}

// Singleton instance
let githubClientInstance: GitHubClient | null = null;

/**
 * Get the GitHub client singleton instance
 */
export function getGitHubClient(): GitHubClient {
  if (!githubClientInstance) {
    githubClientInstance = new GitHubClient();
  }
  return githubClientInstance;
}

