#!/usr/bin/env ts-node

import * as fs from 'fs';
import { getRAG, RAGSourceConfig } from '../src/rag';
import { getLogger } from '../src/utils/logger';
import { getEnvConfig } from '../src/utils/env';

const logger = getLogger();

interface CLIOptions {
  config?: string;
  clear?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--config' && args[i + 1]) {
      options.config = args[i + 1];
      i++;
    } else if (arg === '--clear') {
      options.clear = true;
    }
  }

  return options;
}

/**
 * Load RAG source configuration from file
 */
function loadConfig(configPath: string): RAGSourceConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Main indexing function
 */
async function main() {
  try {
    logger.info('Starting document indexing script');

    // Validate environment
    getEnvConfig();

    const options = parseArgs();

    // Initialize RAG
    const rag = getRAG();
    await rag.initialize();

    // Clear existing documents if requested
    if (options.clear) {
      logger.info('Clearing existing documents...');
      await rag.clearDocuments();
    }

    // Load configuration
    let config: RAGSourceConfig;
    if (options.config) {
      logger.info(`Loading configuration from: ${options.config}`);
      config = loadConfig(options.config);
    } else {
      // Use example configuration
      logger.info('No configuration file specified, using example configuration');
      config = {
        local: {
          files: [
            './docs/requirements_digest.md',
            './docs/test_charter.md',
            './README.md',
          ],
        },
      };
    }

    // Index documents
    await rag.indexDocuments(config);

    // Print summary
    const count = await rag.getDocumentCount();
    logger.info(`Indexing complete! Total documents: ${count}`);

    // Test retrieval
    logger.info('\nTesting retrieval with sample query...');
    const testContext = await rag.fetch('test automation requirements', {
      limit: 3,
    });
    logger.info(`Found ${testContext.results.length} relevant chunks`);
    logger.info(`Citations: ${testContext.citations.length} sources`);

    process.exit(0);
  } catch (error) {
    logger.error('Indexing failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main };

