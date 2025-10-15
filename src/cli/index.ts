#!/usr/bin/env node

import { Command } from 'commander';
import { getOrchestrator, OrchestratorInput } from '../agents/orchestrator';
import { getLogger, logSuccess, logError } from '../utils/logger';
import { getEnvConfig } from '../utils/env';
import * as fs from 'fs';

const logger = getLogger();
const program = new Command();

program
  .name('agentic-playwright')
  .description('Agentic Playwright Testing Framework CLI')
  .version('1.0.0');

/**
 * Run command - Full workflow
 */
program
  .command('run')
  .description('Run the complete agentic workflow (QA + SDET + PR)')
  .requiredOption('-f, --feature <name>', 'Feature name')
  .requiredOption('-p, --prompt <text>', 'User prompt describing the feature')
  .option('-s, --sources <path>', 'Path to RAG sources configuration JSON')
  .option('-e, --env <environment>', 'Test environment (local, dev, staging, prod)')
  .action(async (options) => {
    try {
      logger.info('Starting full agentic workflow');

      const input: OrchestratorInput = {
        userPrompt: options.prompt,
        featureName: options.feature,
        ragSourcesPath: options.sources,
        mode: 'full',
      };

      const orchestrator = getOrchestrator();
      const result = await orchestrator.execute(input);

      if (result.success) {
        logSuccess('Orchestrator', result.message);
        process.exit(0);
      } else {
        logError('Orchestrator', new Error(result.message));
        process.exit(1);
      }
    } catch (error) {
      logError('CLI', error as Error);
      process.exit(1);
    }
  });

/**
 * QA-only command - Scenario generation only
 */
program
  .command('qa-only')
  .description('Run QA Agent only (generate scenarios)')
  .requiredOption('-f, --feature <name>', 'Feature name')
  .requiredOption('-p, --prompt <text>', 'User prompt')
  .option('-s, --sources <path>', 'Path to RAG sources configuration JSON')
  .action(async (options) => {
    try {
      logger.info('Starting QA-only workflow');

      const input: OrchestratorInput = {
        userPrompt: options.prompt,
        featureName: options.feature,
        ragSourcesPath: options.sources,
        mode: 'qa-only',
      };

      const orchestrator = getOrchestrator();
      const result = await orchestrator.execute(input);

      if (result.success && result.qaOutput) {
        logSuccess('QA Agent', `Scenarios generated: ${result.qaOutput.scenariosPath}`);
        process.exit(0);
      } else {
        logError('QA Agent', new Error(result.message));
        process.exit(1);
      }
    } catch (error) {
      logError('CLI', error as Error);
      process.exit(1);
    }
  });

/**
 * SDET-only command - Test implementation only
 */
program
  .command('sdet-only')
  .description('Run SDET Agent only (implement tests from existing scenarios)')
  .requiredOption('-f, --feature <name>', 'Feature name')
  .option('-s, --scenarios <path>', 'Path to scenarios file')
  .action(async (options) => {
    try {
      logger.info('Starting SDET-only workflow');

      const scenariosPath =
        options.scenarios ||
        `tests/_plans/${options.feature.toLowerCase().replace(/\s+/g, '-')}.scenarios.md`;

      if (!fs.existsSync(scenariosPath)) {
        throw new Error(`Scenarios file not found: ${scenariosPath}`);
      }

      const input: OrchestratorInput = {
        userPrompt: `Implement tests for ${options.feature}`,
        featureName: options.feature,
        mode: 'sdet-only',
      };

      const orchestrator = getOrchestrator();
      const result = await orchestrator.execute(input);

      if (result.success) {
        logSuccess('SDET Agent', result.message);
        process.exit(0);
      } else {
        logError('SDET Agent', new Error(result.message));
        process.exit(1);
      }
    } catch (error) {
      logError('CLI', error as Error);
      process.exit(1);
    }
  });

/**
 * Index-docs command - Index RAG documentation
 */
program
  .command('index-docs')
  .description('Index documentation for RAG')
  .option('-c, --config <path>', 'Path to RAG sources configuration JSON')
  .option('--clear', 'Clear existing documents before indexing')
  .action(async (options) => {
    try {
      const { main } = await import('../../scripts/index-docs');
      await main();
    } catch (error) {
      logError('Index Docs', error as Error);
      process.exit(1);
    }
  });

/**
 * Validate command - Validate environment and configuration
 */
program
  .command('validate')
  .description('Validate environment configuration')
  .action(async () => {
    try {
      logger.info('Validating environment configuration');

      const config = getEnvConfig();

      console.log('\n✓ Environment configuration is valid\n');
      console.log('Configuration summary:');
      console.log(`  - OpenAI Model: ${config.openai.model}`);
      console.log(`  - Test Environment: ${config.testEnv.env}`);
      console.log(`  - Test Base URL: ${config.testEnv.baseUrl}`);
      console.log(`  - GitHub Repo: ${config.github.repoOwner}/${config.github.repoName}`);
      console.log(`  - A11y Tests: ${config.featureFlags.enableA11yTests ? 'Enabled' : 'Disabled'}`);

      process.exit(0);
    } catch (error) {
      logError('Validation', error as Error);
      console.error('\n✗ Environment validation failed\n');
      console.error('Please check your .env file and ensure all required variables are set.');
      console.error('See .env.example for reference.\n');
      process.exit(1);
    }
  });

/**
 * Test command - Run Playwright tests directly
 */
program
  .command('test')
  .description('Run Playwright tests')
  .option('-g, --grep <pattern>', 'Only run tests matching pattern')
  .option('-p, --project <name>', 'Run tests in specific project')
  .option('--headed', 'Run tests in headed mode')
  .option('--debug', 'Run tests in debug mode')
  .action(async (options) => {
    try {
      const { getTestRunner } = await import('../utils/testRunner');
      const runner = getTestRunner();

      const result = await runner.run({
        grep: options.grep,
        project: options.project,
        headed: options.headed,
        debug: options.debug,
      });

      if (result.success) {
        logSuccess('Tests', `All ${result.passed} tests passed`);
        process.exit(0);
      } else {
        logError('Tests', new Error(`${result.failed} test(s) failed`));
        process.exit(1);
      }
    } catch (error) {
      logError('Tests', error as Error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

