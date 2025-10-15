import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();

// OpenAI Configuration Schema
const openAIConfigSchema = z.object({
  apiKey: z.string().min(1, 'OPENAI_API_KEY is required'),
  model: z.string().default('gpt-4o'),
  embeddingModel: z.string().default('text-embedding-3-small'),
});

// Jira Configuration Schema
const jiraConfigSchema = z.object({
  baseUrl: z.string().url().optional(),
  email: z.string().email().optional(),
  apiToken: z.string().optional(),
});

// Confluence Configuration Schema
const confluenceConfigSchema = z.object({
  baseUrl: z.string().url().optional(),
  email: z.string().email().optional(),
  apiToken: z.string().optional(),
});

// GitHub Configuration Schema (optional for local/dev)
const githubConfigSchema = z.object({
  token: z.string().optional(),
  repoOwner: z.string().optional(),
  repoName: z.string().optional(),
  baseBranch: z.string().default('main'),
});

// Vector Database Configuration Schema
const chromaConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().default(8000),
  collectionName: z.string().default('agentic_playwright_docs'),
});

// Test Environment Configuration Schema
const testEnvConfigSchema = z.object({
  env: z.enum(['local', 'dev', 'staging', 'prod']).default('staging'),
  baseUrl: z.string().url('TEST_BASE_URL must be a valid URL'),
  username: z.string().optional(),
  password: z.string().optional(),
});

// Additional Environment URLs
const envUrlsSchema = z.object({
  dev: z.string().url().optional(),
  staging: z.string().url().optional(),
  prod: z.string().url().optional(),
});

// Playwright MCP Configuration Schema
const playwrightMcpConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().default(3000),
});

// General MCP configuration (for hosted or stdio transport)
const mcpConfigSchema = z.object({
  transport: z.enum(['stdio', 'http']).default('stdio'),
  baseURL: z.string().url().optional(),
  token: z.string().optional(),
});

// Feature Flags Schema
const featureFlagsSchema = z.object({
  enableA11yTests: z.boolean().default(true),
  enableVisualRegression: z.boolean().default(false),
  enablePerformanceTests: z.boolean().default(false),
});

// Logging Configuration Schema
const loggingConfigSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  logFile: z.string().default('logs/agentic-playwright.log'),
});

// Complete Environment Configuration Schema
const envConfigSchema = z.object({
  openai: openAIConfigSchema,
  jira: jiraConfigSchema,
  confluence: confluenceConfigSchema,
  github: githubConfigSchema,
  chroma: chromaConfigSchema,
  testEnv: testEnvConfigSchema,
  envUrls: envUrlsSchema,
  playwrightMcp: playwrightMcpConfigSchema,
  mcp: mcpConfigSchema,
  featureFlags: featureFlagsSchema,
  logging: loggingConfigSchema,
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});

export type EnvConfig = z.infer<typeof envConfigSchema>;
export type TestEnvType = z.infer<typeof testEnvConfigSchema>['env'];

/**
 * Parse and validate environment variables
 * @throws {z.ZodError} if required environment variables are missing or invalid
 */
function parseEnvironment(): EnvConfig {
  const config = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    },
    jira: {
      baseUrl: process.env.JIRA_BASE_URL,
      email: process.env.JIRA_EMAIL,
      apiToken: process.env.JIRA_API_TOKEN,
    },
    confluence: {
      baseUrl: process.env.CONFLUENCE_BASE_URL,
      email: process.env.CONFLUENCE_EMAIL,
      apiToken: process.env.CONFLUENCE_API_TOKEN,
    },
    github: {
      token: process.env.GITHUB_TOKEN || '',
      repoOwner: process.env.GITHUB_REPO_OWNER || '',
      repoName: process.env.GITHUB_REPO_NAME || '',
      baseBranch: process.env.GITHUB_BASE_BRANCH || 'main',
    },
    chroma: {
      host: process.env.CHROMA_HOST || 'localhost',
      port: parseInt(process.env.CHROMA_PORT || '8000', 10),
      collectionName: process.env.CHROMA_COLLECTION_NAME || 'agentic_playwright_docs',
    },
    testEnv: {
      env: (process.env.TEST_ENV as TestEnvType) || 'staging',
      baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
      username: process.env.TEST_USERNAME,
      password: process.env.TEST_PASSWORD,
    },
    envUrls: {
      dev: process.env.DEV_BASE_URL,
      staging: process.env.STAGING_BASE_URL,
      prod: process.env.PROD_BASE_URL,
    },
    playwrightMcp: {
      host: process.env.PLAYWRIGHT_MCP_HOST || 'localhost',
      port: parseInt(process.env.PLAYWRIGHT_MCP_PORT || '3000', 10),
    },
    mcp: {
      transport: (process.env.MCP_TRANSPORT as 'stdio' | 'http') || 'stdio',
      baseURL: process.env.MCP_BASE_URL,
      token: process.env.MCP_TOKEN,
    },
    featureFlags: {
      enableA11yTests: process.env.ENABLE_A11Y_TESTS === 'true',
      enableVisualRegression: process.env.ENABLE_VISUAL_REGRESSION === 'true',
      enablePerformanceTests: process.env.ENABLE_PERFORMANCE_TESTS === 'true',
    },
    logging: {
      level: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
      logFile: process.env.LOG_FILE || 'logs/agentic-playwright.log',
    },
    nodeEnv: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
  };

  return envConfigSchema.parse(config);
}

/**
 * Get the base URL for a specific environment
 */
export function getBaseUrlForEnv(env: TestEnvType, config: EnvConfig): string {
  switch (env) {
    case 'local':
      return 'http://localhost:3000';
    case 'dev':
      return config.envUrls.dev || config.testEnv.baseUrl;
    case 'staging':
      return config.envUrls.staging || config.testEnv.baseUrl;
    case 'prod':
      return config.envUrls.prod || config.testEnv.baseUrl;
    default:
      return config.testEnv.baseUrl;
  }
}

/**
 * Validate that required environment variables are set
 * This function will throw an error with helpful messages if validation fails
 */
export function validateEnvironment(): EnvConfig {
  try {
    const config = parseEnvironment();
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => {
        const path = err.path.join('.');
        return `  - ${path}: ${err.message}`;
      });

      throw new Error(
        `Environment validation failed:\n${missingVars.join('\n')}\n\n` +
          `Please check your .env file and ensure all required variables are set.\n` +
          `See .env.example for reference.`
      );
    }
    throw error;
  }
}

/**
 * Get validated environment configuration
 * This is a singleton that validates once and caches the result
 */
let cachedConfig: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (!cachedConfig) {
    cachedConfig = validateEnvironment();
  }
  return cachedConfig;
}

/**
 * Check if Jira integration is configured
 */
export function isJiraConfigured(config: EnvConfig): boolean {
  return !!(config.jira.baseUrl && config.jira.email && config.jira.apiToken);
}

/**
 * Check if Confluence integration is configured
 */
export function isConfluenceConfigured(config: EnvConfig): boolean {
  return !!(
    config.confluence.baseUrl &&
    config.confluence.email &&
    config.confluence.apiToken
  );
}

/**
 * Get the project root directory
 */
export function getProjectRoot(): string {
  return path.resolve(__dirname, '../..');
}

/**
 * Get absolute path relative to project root
 */
export function getAbsolutePath(relativePath: string): string {
  return path.resolve(getProjectRoot(), relativePath);
}

// Export for testing purposes
export { envConfigSchema };

