/**
 * Agentic Playwright - Main Entry Point
 * 
 * This is the main entry point for programmatic usage of the framework.
 * For CLI usage, use src/cli/index.ts
 */

import { getOrchestrator, OrchestratorInput, OrchestratorOutput } from './agents/orchestrator';
import { getQAAgent, QAInput, QAOutput } from './agents/qaAgent';
import { getSDETAgent, SDETInput, SDETOutput } from './agents/sdetAgent';
import { getRAG, RAGSourceConfig } from './rag';
import { getVectorStore } from './rag/vectorStore';
import { getPlaywrightClient } from './mcp/playwrightClient';
import { getGitHubClient } from './mcp/githubClient';
import { getPRWorkflow } from './workflows/prWorkflow';
import { getTestRunner } from './utils/testRunner';
import { getReportGenerator } from './utils/reportGenerator';
import { getQualityGates } from './utils/qualityGates';
import { getLogger } from './utils/logger';
import { getEnvConfig, validateEnvironment } from './utils/env';

const logger = getLogger();

/**
 * Main AgenticPlaywright class
 */
export class AgenticPlaywright {
  // Agents
  public readonly orchestrator = getOrchestrator();
  public readonly qaAgent = getQAAgent();
  public readonly sdetAgent = getSDETAgent();

  // RAG
  public readonly rag = getRAG();
  public readonly vectorStore = getVectorStore();

  // MCP Clients
  public readonly playwrightClient = getPlaywrightClient();
  public readonly githubClient = getGitHubClient();

  // Workflows
  public readonly prWorkflow = getPRWorkflow();

  // Utilities
  public readonly testRunner = getTestRunner();
  public readonly reportGenerator = getReportGenerator();
  public readonly qualityGates = getQualityGates();

  constructor() {
    logger.info('AgenticPlaywright framework initialized');
  }

  /**
   * Run the complete agentic workflow
   */
  async run(input: OrchestratorInput): Promise<OrchestratorOutput> {
    return this.orchestrator.execute(input);
  }

  /**
   * Run QA Agent only
   */
  async runQA(input: QAInput): Promise<QAOutput> {
    return this.qaAgent.execute(input);
  }

  /**
   * Run SDET Agent only
   */
  async runSDET(input: SDETInput): Promise<SDETOutput> {
    return this.sdetAgent.execute(input);
  }

  /**
   * Index RAG documents
   */
  async indexDocuments(sources: RAGSourceConfig): Promise<void> {
    await this.rag.initialize();
    await this.rag.indexDocuments(sources);
  }

  /**
   * Validate environment configuration
   */
  validateEnvironment(): void {
    validateEnvironment();
    logger.info('Environment validation passed');
  }

  /**
   * Get environment configuration
   */
  getConfig() {
    return getEnvConfig();
  }
}

// Export singleton instance
let agenticPlaywrightInstance: AgenticPlaywright | null = null;

/**
 * Get AgenticPlaywright singleton instance
 */
export function getAgenticPlaywright(): AgenticPlaywright {
  if (!agenticPlaywrightInstance) {
    agenticPlaywrightInstance = new AgenticPlaywright();
  }
  return agenticPlaywrightInstance;
}

// Export all types and classes
export * from './agents/orchestrator';
export * from './agents/qaAgent';
export * from './agents/sdetAgent';
export * from './rag';
export * from './mcp/playwrightClient';
export * from './mcp/githubClient';
export * from './workflows/prWorkflow';
export * from './utils/testRunner';
export * from './utils/reportGenerator';
export * from './utils/qualityGates';
export * from './utils/env';
export * from './utils/logger';
export * from './utils/accessibility';

// Export default
export default AgenticPlaywright;

