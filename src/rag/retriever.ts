import { getVectorStore, SearchResult } from './vectorStore';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export interface RetrievalContext {
  query: string;
  results: SearchResult[];
  citations: Citation[];
  formattedContext: string;
}

export interface Citation {
  id: string;
  source: string;
  sourceType: 'jira' | 'confluence' | 'local';
  title?: string;
  url?: string;
  relevanceScore: number;
}

/**
 * RAG Retriever for context extraction
 */
export class Retriever {
  private vectorStore = getVectorStore();

  /**
   * Retrieve relevant context for a query
   */
  async retrieve(
    query: string,
    options: {
      limit?: number;
      minScore?: number;
      sourceTypes?: Array<'jira' | 'confluence' | 'local'>;
    } = {}
  ): Promise<RetrievalContext> {
    const { limit = 10, minScore = 0.3, sourceTypes } = options;

    logger.info('Retrieving context', { query, limit, minScore, sourceTypes });

    // Build filter if source types specified
    const filter = sourceTypes
      ? { sourceType: { $in: sourceTypes } }
      : undefined;

    // Search vector store
    const results = await this.vectorStore.search(query, limit, filter);

    // Filter by minimum score
    const filteredResults = results.filter((result) => result.score >= minScore);

    // Extract unique citations
    const citations = this.extractCitations(filteredResults);

    // Format context for LLM consumption
    const formattedContext = this.formatContext(filteredResults);

    logger.info(`Retrieved ${filteredResults.length} relevant chunks with ${citations.length} unique sources`);

    return {
      query,
      results: filteredResults,
      citations,
      formattedContext,
    };
  }

  /**
   * Extract unique citations from search results
   */
  private extractCitations(results: SearchResult[]): Citation[] {
    const citationMap = new Map<string, Citation>();

    for (const result of results) {
      const key = result.metadata.source;
      
      if (!citationMap.has(key)) {
        citationMap.set(key, {
          id: result.id,
          source: result.metadata.source,
          sourceType: result.metadata.sourceType,
          title: result.metadata.title,
          url: result.metadata.url,
          relevanceScore: result.score,
        });
      } else {
        // Update score if this result is more relevant
        const existing = citationMap.get(key)!;
        if (result.score > existing.relevanceScore) {
          existing.relevanceScore = result.score;
        }
      }
    }

    // Sort by relevance score descending
    return Array.from(citationMap.values()).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Format context for LLM consumption
   */
  private formatContext(results: SearchResult[]): string {
    if (results.length === 0) {
      return 'No relevant context found.';
    }

    const sections: string[] = [];

    // Group by source
    const groupedResults = new Map<string, SearchResult[]>();
    for (const result of results) {
      const source = result.metadata.source;
      if (!groupedResults.has(source)) {
        groupedResults.set(source, []);
      }
      groupedResults.get(source)!.push(result);
    }

    // Format each source
    for (const [source, sourceResults] of groupedResults) {
      const firstResult = sourceResults[0];
      const metadata = firstResult.metadata;

      let header = `### ${metadata.sourceType.toUpperCase()}: ${metadata.title || source}`;
      if (metadata.url) {
        header += `\n**URL**: ${metadata.url}`;
      }
      if (metadata.issueKey) {
        header += `\n**Issue**: ${metadata.issueKey}`;
      }

      const content = sourceResults
        .sort((a, b) => (a.metadata.chunkIndex as number) - (b.metadata.chunkIndex as number))
        .map((r) => r.content)
        .join('\n\n');

      sections.push(`${header}\n\n${content}`);
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * Retrieve context with automatic query expansion
   */
  async retrieveWithExpansion(
    query: string,
    expansions: string[],
    options: {
      limit?: number;
      minScore?: number;
      sourceTypes?: Array<'jira' | 'confluence' | 'local'>;
    } = {}
  ): Promise<RetrievalContext> {
    // Retrieve for main query
    const mainContext = await this.retrieve(query, options);

    // Retrieve for expansions
    const expansionContexts = await Promise.all(
      expansions.map((expansion) => this.retrieve(expansion, { ...options, limit: 5 }))
    );

    // Combine results, removing duplicates
    const allResults = [mainContext, ...expansionContexts].flatMap((ctx) => ctx.results);
    const uniqueResults = Array.from(
      new Map(allResults.map((r) => [r.id, r])).values()
    );

    // Sort by score
    uniqueResults.sort((a, b) => b.score - a.score);

    // Limit results
    const limitedResults = uniqueResults.slice(0, options.limit || 10);

    // Extract citations and format
    const citations = this.extractCitations(limitedResults);
    const formattedContext = this.formatContext(limitedResults);

    return {
      query,
      results: limitedResults,
      citations,
      formattedContext,
    };
  }

  /**
   * Retrieve context for multiple related queries
   */
  async retrieveMultiple(
    queries: string[],
    options: {
      limit?: number;
      minScore?: number;
      sourceTypes?: Array<'jira' | 'confluence' | 'local'>;
    } = {}
  ): Promise<RetrievalContext> {
    const contexts = await Promise.all(
      queries.map((query) => this.retrieve(query, options))
    );

    // Combine all results
    const allResults = contexts.flatMap((ctx) => ctx.results);
    const uniqueResults = Array.from(
      new Map(allResults.map((r) => [r.id, r])).values()
    );

    // Sort by score
    uniqueResults.sort((a, b) => b.score - a.score);

    // Limit results
    const limitedResults = uniqueResults.slice(0, options.limit || 15);

    // Extract citations and format
    const citations = this.extractCitations(limitedResults);
    const formattedContext = this.formatContext(limitedResults);

    return {
      query: queries.join(' | '),
      results: limitedResults,
      citations,
      formattedContext,
    };
  }

  /**
   * Get context by specific source
   */
  async retrieveBySource(
    source: string,
    sourceType: 'jira' | 'confluence' | 'local'
  ): Promise<RetrievalContext> {
    logger.info('Retrieving by source', { source, sourceType });

    const documents = await this.vectorStore.getDocumentsBySourceType(sourceType);
    const results = documents.filter((doc) => doc.metadata.source === source);

    if (results.length === 0) {
      logger.warn(`No documents found for source: ${source}`);
      return {
        query: source,
        results: [],
        citations: [],
        formattedContext: 'No documents found for this source.',
      };
    }

    const citations = this.extractCitations(results);
    const formattedContext = this.formatContext(results);

    return {
      query: source,
      results,
      citations,
      formattedContext,
    };
  }
}

// Singleton instance
let retrieverInstance: Retriever | null = null;

/**
 * Get the retriever singleton instance
 */
export function getRetriever(): Retriever {
  if (!retrieverInstance) {
    retrieverInstance = new Retriever();
  }
  return retrieverInstance;
}

