import { ChromaClient, Collection, OpenAIEmbeddingFunction } from 'chromadb';
import { getEnvConfig } from '../utils/env';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export interface Document {
  id: string;
  content: string;
  metadata: {
    source: string;
    sourceType: 'jira' | 'confluence' | 'local';
    title?: string;
    url?: string;
    issueKey?: string;
    pageId?: string;
    filePath?: string;
    timestamp: string;
    [key: string]: unknown;
  };
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: Document['metadata'];
  score: number;
}

/**
 * Vector Store Manager using ChromaDB
 */
export class VectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private embeddingFunction: OpenAIEmbeddingFunction;
  private collectionName: string;

  constructor() {
    const config = getEnvConfig();
    
    this.collectionName = config.chroma.collectionName;
    
    // Initialize ChromaDB client
    this.client = new ChromaClient({
      path: `http://${config.chroma.host}:${config.chroma.port}`,
    });

    // Initialize OpenAI embedding function
    this.embeddingFunction = new OpenAIEmbeddingFunction({
      openai_api_key: config.openai.apiKey,
      openai_model: config.openai.embeddingModel,
    });

    logger.info('VectorStore initialized', {
      host: config.chroma.host,
      port: config.chroma.port,
      collection: this.collectionName,
    });
  }

  /**
   * Initialize or get the collection
   */
  async initialize(): Promise<void> {
    try {
      // Try to get existing collection
      this.collection = await this.client.getCollection({
        name: this.collectionName,
        embeddingFunction: this.embeddingFunction,
      });
      logger.info(`Using existing collection: ${this.collectionName}`);
    } catch (error) {
      // Collection doesn't exist, create it
      this.collection = await this.client.createCollection({
        name: this.collectionName,
        embeddingFunction: this.embeddingFunction,
        metadata: { description: 'Agentic Playwright requirements and documentation' },
      });
      logger.info(`Created new collection: ${this.collectionName}`);
    }
  }

  /**
   * Add documents to the vector store
   */
  async addDocuments(documents: Document[]): Promise<void> {
    if (!this.collection) {
      await this.initialize();
    }

    if (documents.length === 0) {
      logger.warn('No documents to add to vector store');
      return;
    }

    const ids = documents.map((doc) => doc.id);
    const contents = documents.map((doc) => doc.content);
    const metadatas = documents.map((doc) => {
      const metadata: Record<string, string | number | boolean> = {};
      for (const [k, v] of Object.entries(doc.metadata)) {
        if (v === undefined || v === null) continue;
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          metadata[k] = v;
        } else {
          // Fallback to JSON string for complex values
          try {
            metadata[k] = JSON.stringify(v as unknown as object);
          } catch {
            metadata[k] = String(v);
          }
        }
      }
      return metadata as any;
    });

    await this.collection!.add({
      ids,
      documents: contents,
      metadatas,
    });

    logger.info(`Added ${documents.length} documents to vector store`);
  }

  /**
   * Search for similar documents
   */
  async search(query: string, limit: number = 5, filter?: Record<string, unknown>): Promise<SearchResult[]> {
    if (!this.collection) {
      await this.initialize();
    }

    const results = await this.collection!.query({
      queryTexts: [query],
      nResults: limit,
      where: filter,
    });

    if (!results.ids || !results.ids[0] || results.ids[0].length === 0) {
      logger.info('No results found for query', { query, filter });
      return [];
    }

    const searchResults: SearchResult[] = [];
    for (let i = 0; i < results.ids[0].length; i++) {
      searchResults.push({
        id: results.ids[0][i],
        content: results.documents?.[0]?.[i] as string || '',
        metadata: results.metadatas?.[0]?.[i] as Document['metadata'],
        score: results.distances?.[0]?.[i] || 0,
      });
    }

    logger.info(`Found ${searchResults.length} results for query`, { query });
    return searchResults;
  }

  /**
   * Delete documents by IDs
   */
  async deleteDocuments(ids: string[]): Promise<void> {
    if (!this.collection) {
      await this.initialize();
    }

    await this.collection!.delete({ ids });
    logger.info(`Deleted ${ids.length} documents from vector store`);
  }

  /**
   * Clear all documents from the collection
   */
  async clear(): Promise<void> {
    if (!this.collection) {
      await this.initialize();
    }

    // Delete and recreate collection
    await this.client.deleteCollection({ name: this.collectionName });
    this.collection = await this.client.createCollection({
      name: this.collectionName,
      embeddingFunction: this.embeddingFunction,
    });

    logger.info('Cleared all documents from vector store');
  }

  /**
   * Get document count
   */
  async count(): Promise<number> {
    if (!this.collection) {
      await this.initialize();
    }

    const result = await this.collection!.count();
    return result;
  }

  /**
   * Check if collection exists and has documents
   */
  async hasDocuments(): Promise<boolean> {
    try {
      const count = await this.count();
      return count > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get documents by source type
   */
  async getDocumentsBySourceType(sourceType: 'jira' | 'confluence' | 'local'): Promise<SearchResult[]> {
    if (!this.collection) {
      await this.initialize();
    }

    const results = await this.collection!.get({
      where: { sourceType },
    });

    if (!results.ids || results.ids.length === 0) {
      return [];
    }

    const documents: SearchResult[] = [];
    for (let i = 0; i < results.ids.length; i++) {
      documents.push({
        id: results.ids[i],
        content: results.documents?.[i] as string || '',
        metadata: results.metadatas?.[i] as Document['metadata'],
        score: 1.0, // Perfect score for direct retrieval
      });
    }

    return documents;
  }

  /**
   * Update document metadata
   */
  async updateMetadata(id: string, metadata: Partial<Document['metadata']>): Promise<void> {
    if (!this.collection) {
      await this.initialize();
    }

    await this.collection!.update({
      ids: [id],
      metadatas: [metadata as any],
    });

    logger.info(`Updated metadata for document: ${id}`);
  }
}

// Singleton instance
let vectorStoreInstance: VectorStore | null = null;

/**
 * Get the vector store singleton instance
 */
export function getVectorStore(): VectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorStore();
  }
  return vectorStoreInstance;
}

