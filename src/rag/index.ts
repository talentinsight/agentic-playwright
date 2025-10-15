import { getVectorStore, Document } from './vectorStore';
import { JiraLoader, ConfluenceLoader, LocalFileLoader } from './documentLoader';
import { getRetriever, RetrievalContext } from './retriever';
import { getLogger } from '../utils/logger';
import { isJiraConfigured, isConfluenceConfigured, getEnvConfig } from '../utils/env';

const logger = getLogger();

export interface RAGSourceConfig {
  jira?: {
    issues?: string[];
    jql?: string;
  };
  confluence?: {
    pageIds?: string[];
    urls?: string[];
  };
  local?: {
    files?: string[];
  };
}

/**
 * Main RAG interface for the agentic workflow
 */
export class RAG {
  private vectorStore = getVectorStore();
  private retriever = getRetriever();

  /**
   * Initialize vector store
   */
  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
  }

  /**
   * Index documents from various sources
   */
  async indexDocuments(config: RAGSourceConfig): Promise<void> {
    logger.info('Starting document indexing', { config });

    const allDocuments: Document[] = [];

    // Index Jira issues
    if (config.jira) {
      const envConfig = getEnvConfig();
      if (isJiraConfigured(envConfig)) {
        const jiraLoader = new JiraLoader();

        if (config.jira.issues) {
          logger.info(`Indexing ${config.jira.issues.length} Jira issues`);
          const jiraDocuments = await jiraLoader.fetchIssues(config.jira.issues);
          allDocuments.push(...jiraDocuments);
        }

        if (config.jira.jql) {
          logger.info(`Searching Jira with JQL: ${config.jira.jql}`);
          const jiraDocuments = await jiraLoader.searchIssues(config.jira.jql);
          allDocuments.push(...jiraDocuments);
        }
      } else {
        logger.warn('Jira configuration is incomplete, skipping Jira indexing');
      }
    }

    // Index Confluence pages
    if (config.confluence) {
      const envConfig = getEnvConfig();
      if (isConfluenceConfigured(envConfig)) {
        const confluenceLoader = new ConfluenceLoader();

        if (config.confluence.pageIds) {
          logger.info(`Indexing ${config.confluence.pageIds.length} Confluence pages`);
          const confluenceDocuments = await confluenceLoader.fetchPages(config.confluence.pageIds);
          allDocuments.push(...confluenceDocuments);
        }

        if (config.confluence.urls) {
          logger.info(`Indexing ${config.confluence.urls.length} Confluence URLs`);
          for (const url of config.confluence.urls) {
            const documents = await confluenceLoader.fetchPageByUrl(url);
            allDocuments.push(...documents);
          }
        }
      } else {
        logger.warn('Confluence configuration is incomplete, skipping Confluence indexing');
      }
    }

    // Index local files
    if (config.local?.files) {
      logger.info(`Indexing ${config.local.files.length} local files`);
      const localLoader = new LocalFileLoader();
      const localDocuments = await localLoader.loadFiles(config.local.files);
      allDocuments.push(...localDocuments);
    }

    // Add all documents to vector store
    if (allDocuments.length > 0) {
      await this.vectorStore.addDocuments(allDocuments);
      logger.info(`Indexed ${allDocuments.length} total document chunks`);
    } else {
      logger.warn('No documents were indexed');
    }
  }

  /**
   * Fetch context for a query (main RAG interface)
   */
  async fetch(
    query: string,
    options: {
      limit?: number;
      minScore?: number;
      sourceTypes?: Array<'jira' | 'confluence' | 'local'>;
      expandQuery?: boolean;
    } = {}
  ): Promise<RetrievalContext> {
    const { expandQuery = false, ...retrieveOptions } = options;

    if (expandQuery) {
      // Generate query expansions for better retrieval
      const expansions = this.generateQueryExpansions(query);
      return this.retriever.retrieveWithExpansion(query, expansions, retrieveOptions);
    }

    return this.retriever.retrieve(query, retrieveOptions);
  }

  /**
   * Fetch context for multiple related queries
   */
  async fetchMultiple(
    queries: string[],
    options: {
      limit?: number;
      minScore?: number;
      sourceTypes?: Array<'jira' | 'confluence' | 'local'>;
    } = {}
  ): Promise<RetrievalContext> {
    return this.retriever.retrieveMultiple(queries, options);
  }

  /**
   * Get context by specific source
   */
  async fetchBySource(
    source: string,
    sourceType: 'jira' | 'confluence' | 'local'
  ): Promise<RetrievalContext> {
    return this.retriever.retrieveBySource(source, sourceType);
  }

  /**
   * Check if documents are indexed
   */
  async hasDocuments(): Promise<boolean> {
    return this.vectorStore.hasDocuments();
  }

  /**
   * Get document count
   */
  async getDocumentCount(): Promise<number> {
    return this.vectorStore.count();
  }

  /**
   * Clear all indexed documents
   */
  async clearDocuments(): Promise<void> {
    await this.vectorStore.clear();
    logger.info('Cleared all indexed documents');
  }

  /**
   * Generate query expansions for better retrieval
   */
  private generateQueryExpansions(query: string): string[] {
    const expansions: string[] = [];

    // Add common test-related expansions
    if (query.toLowerCase().includes('test')) {
      expansions.push(query.replace(/test/gi, 'scenario'));
      expansions.push(query.replace(/test/gi, 'validation'));
    }

    // Add feature-related expansions
    if (query.toLowerCase().includes('feature')) {
      expansions.push(query.replace(/feature/gi, 'functionality'));
      expansions.push(query.replace(/feature/gi, 'requirement'));
    }

    // Add user story expansions
    if (query.toLowerCase().includes('user')) {
      expansions.push(query.replace(/user/gi, 'customer'));
      expansions.push(query + ' acceptance criteria');
    }

    return expansions.slice(0, 3); // Limit to 3 expansions
  }
}

// Singleton instance
let ragInstance: RAG | null = null;

/**
 * Get the RAG singleton instance
 */
export function getRAG(): RAG {
  if (!ragInstance) {
    ragInstance = new RAG();
  }
  return ragInstance;
}

// Re-export types
export type { RetrievalContext, Citation } from './retriever';
export type { Document, SearchResult } from './vectorStore';
export type { RAGSourceConfig };

