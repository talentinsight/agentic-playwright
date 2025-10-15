import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { marked } from 'marked';
import * as cheerio from 'cheerio';
import pdfParse from 'pdf-parse';
import { getEnvConfig, isJiraConfigured, isConfluenceConfigured } from '../utils/env';
import { getLogger } from '../utils/logger';
import { Document } from './vectorStore';

const logger = getLogger();

/**
 * Chunk text into smaller pieces for embedding
 */
function chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Add overlap by keeping last part of previous chunk
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      currentChunk = overlapWords.join(' ') + ' ' + sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Jira Document Loader
 */
export class JiraLoader {
  private client: AxiosInstance;
  private config;

  constructor() {
    this.config = getEnvConfig();

    if (!isJiraConfigured(this.config)) {
      throw new Error('Jira configuration is incomplete. Check JIRA_* environment variables.');
    }

    this.client = axios.create({
      baseURL: this.config.jira.baseUrl,
      auth: {
        username: this.config.jira.email!,
        password: this.config.jira.apiToken!,
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch a single Jira issue
   */
  async fetchIssue(issueKey: string): Promise<Document[]> {
    try {
      logger.info(`Fetching Jira issue: ${issueKey}`);
      
      const response = await this.client.get(`/rest/api/3/issue/${issueKey}`);
      const issue = response.data;

      // Extract relevant content
      const summary = issue.fields.summary || '';
      const description = issue.fields.description?.content?.map((c: unknown) => 
        JSON.stringify(c)
      ).join('\n') || '';
      const issueType = issue.fields.issuetype?.name || '';
      const status = issue.fields.status?.name || '';
      const priority = issue.fields.priority?.name || '';
      
      // Extract acceptance criteria if available
      const acceptanceCriteria = issue.fields.customfield_10000 || '';

      // Combine all content
      const fullContent = `
Issue: ${issueKey}
Type: ${issueType}
Status: ${status}
Priority: ${priority}
Summary: ${summary}

Description:
${description}

${acceptanceCriteria ? `Acceptance Criteria:\n${acceptanceCriteria}` : ''}
      `.trim();

      // Chunk the content
      const chunks = chunkText(fullContent);
      const documents: Document[] = chunks.map((chunk, index) => ({
        id: `jira-${issueKey}-${index}`,
        content: chunk,
        metadata: {
          source: issueKey,
          sourceType: 'jira',
          title: summary,
          url: `${this.config.jira.baseUrl}/browse/${issueKey}`,
          issueKey,
          issueType,
          status,
          priority,
          timestamp: new Date().toISOString(),
          chunkIndex: index,
          totalChunks: chunks.length,
        },
      }));

      logger.info(`Loaded Jira issue ${issueKey}: ${documents.length} chunks`);
      return documents;
    } catch (error) {
      logger.error(`Failed to fetch Jira issue ${issueKey}:`, error);
      throw error;
    }
  }

  /**
   * Fetch multiple Jira issues
   */
  async fetchIssues(issueKeys: string[]): Promise<Document[]> {
    const allDocuments: Document[] = [];

    for (const issueKey of issueKeys) {
      try {
        const documents = await this.fetchIssue(issueKey);
        allDocuments.push(...documents);
      } catch (error) {
        logger.warn(`Skipping issue ${issueKey} due to error`);
      }
    }

    return allDocuments;
  }

  /**
   * Search Jira issues by JQL
   */
  async searchIssues(jql: string, maxResults: number = 50): Promise<Document[]> {
    try {
      logger.info(`Searching Jira with JQL: ${jql}`);
      
      const response = await this.client.post('/rest/api/3/search', {
        jql,
        maxResults,
        fields: ['summary', 'description', 'issuetype', 'status', 'priority'],
      });

      const issueKeys = response.data.issues.map((issue: { key: string }) => issue.key);
      return this.fetchIssues(issueKeys);
    } catch (error) {
      logger.error('Failed to search Jira issues:', error);
      throw error;
    }
  }
}

/**
 * Confluence Document Loader
 */
export class ConfluenceLoader {
  private client: AxiosInstance;
  private config;

  constructor() {
    this.config = getEnvConfig();

    if (!isConfluenceConfigured(this.config)) {
      throw new Error(
        'Confluence configuration is incomplete. Check CONFLUENCE_* environment variables.'
      );
    }

    this.client = axios.create({
      baseURL: this.config.confluence.baseUrl,
      auth: {
        username: this.config.confluence.email!,
        password: this.config.confluence.apiToken!,
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch a single Confluence page
   */
  async fetchPage(pageId: string): Promise<Document[]> {
    try {
      logger.info(`Fetching Confluence page: ${pageId}`);
      
      const response = await this.client.get(
        `/rest/api/content/${pageId}?expand=body.storage,version`
      );
      const page = response.data;

      const title = page.title || '';
      const htmlContent = page.body?.storage?.value || '';
      
      // Convert HTML to plain text
      const $ = cheerio.load(htmlContent);
      const textContent = $.text();

      const fullContent = `
Page: ${title}

${textContent}
      `.trim();

      // Chunk the content
      const chunks = chunkText(fullContent);
      const documents: Document[] = chunks.map((chunk, index) => ({
        id: `confluence-${pageId}-${index}`,
        content: chunk,
        metadata: {
          source: pageId,
          sourceType: 'confluence',
          title,
          url: `${this.config.confluence.baseUrl}/pages/viewpage.action?pageId=${pageId}`,
          pageId,
          timestamp: new Date().toISOString(),
          chunkIndex: index,
          totalChunks: chunks.length,
        },
      }));

      logger.info(`Loaded Confluence page ${pageId}: ${documents.length} chunks`);
      return documents;
    } catch (error) {
      logger.error(`Failed to fetch Confluence page ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch multiple Confluence pages
   */
  async fetchPages(pageIds: string[]): Promise<Document[]> {
    const allDocuments: Document[] = [];

    for (const pageId of pageIds) {
      try {
        const documents = await this.fetchPage(pageId);
        allDocuments.push(...documents);
      } catch (error) {
        logger.warn(`Skipping page ${pageId} due to error`);
      }
    }

    return allDocuments;
  }

  /**
   * Fetch page by URL (extract pageId from URL)
   */
  async fetchPageByUrl(url: string): Promise<Document[]> {
    const pageIdMatch = url.match(/pageId=(\d+)/);
    if (!pageIdMatch) {
      throw new Error(`Could not extract pageId from URL: ${url}`);
    }
    return this.fetchPage(pageIdMatch[1]);
  }
}

/**
 * Local File Loader
 */
export class LocalFileLoader {
  /**
   * Load a markdown file
   */
  async loadMarkdown(filePath: string): Promise<Document[]> {
    try {
      logger.info(`Loading markdown file: ${filePath}`);
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const htmlContent = await marked(content);
      const $ = cheerio.load(htmlContent);
      const textContent = $.text();

      const fileName = path.basename(filePath);
      const fullContent = `
File: ${fileName}

${textContent}
      `.trim();

      // Chunk the content
      const chunks = chunkText(fullContent);
      const documents: Document[] = chunks.map((chunk, index) => ({
        id: `local-${fileName}-${index}`,
        content: chunk,
        metadata: {
          source: fileName,
          sourceType: 'local',
          title: fileName,
          filePath,
          timestamp: new Date().toISOString(),
          chunkIndex: index,
          totalChunks: chunks.length,
        },
      }));

      logger.info(`Loaded markdown file ${fileName}: ${documents.length} chunks`);
      return documents;
    } catch (error) {
      logger.error(`Failed to load markdown file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Load a PDF file
   */
  async loadPDF(filePath: string): Promise<Document[]> {
    try {
      logger.info(`Loading PDF file: ${filePath}`);
      
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      const textContent = pdfData.text;

      const fileName = path.basename(filePath);
      const fullContent = `
File: ${fileName}

${textContent}
      `.trim();

      // Chunk the content
      const chunks = chunkText(fullContent);
      const documents: Document[] = chunks.map((chunk, index) => ({
        id: `local-${fileName}-${index}`,
        content: chunk,
        metadata: {
          source: fileName,
          sourceType: 'local',
          title: fileName,
          filePath,
          timestamp: new Date().toISOString(),
          chunkIndex: index,
          totalChunks: chunks.length,
        },
      }));

      logger.info(`Loaded PDF file ${fileName}: ${documents.length} chunks`);
      return documents;
    } catch (error) {
      logger.error(`Failed to load PDF file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Load a text file
   */
  async loadText(filePath: string): Promise<Document[]> {
    try {
      logger.info(`Loading text file: ${filePath}`);
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileName = path.basename(filePath);

      const fullContent = `
File: ${fileName}

${content}
      `.trim();

      // Chunk the content
      const chunks = chunkText(fullContent);
      const documents: Document[] = chunks.map((chunk, index) => ({
        id: `local-${fileName}-${index}`,
        content: chunk,
        metadata: {
          source: fileName,
          sourceType: 'local',
          title: fileName,
          filePath,
          timestamp: new Date().toISOString(),
          chunkIndex: index,
          totalChunks: chunks.length,
        },
      }));

      logger.info(`Loaded text file ${fileName}: ${documents.length} chunks`);
      return documents;
    } catch (error) {
      logger.error(`Failed to load text file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Load a file (auto-detect type)
   */
  async loadFile(filePath: string): Promise<Document[]> {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.md':
      case '.markdown':
        return this.loadMarkdown(filePath);
      case '.pdf':
        return this.loadPDF(filePath);
      case '.txt':
        return this.loadText(filePath);
      default:
        // Try as text file
        return this.loadText(filePath);
    }
  }

  /**
   * Load multiple files
   */
  async loadFiles(filePaths: string[]): Promise<Document[]> {
    const allDocuments: Document[] = [];

    for (const filePath of filePaths) {
      try {
        const documents = await this.loadFile(filePath);
        allDocuments.push(...documents);
      } catch (error) {
        logger.warn(`Skipping file ${filePath} due to error`);
      }
    }

    return allDocuments;
  }
}

/**
 * Create appropriate loader based on source type
 */
export function createLoader(sourceType: 'jira' | 'confluence' | 'local') {
  switch (sourceType) {
    case 'jira':
      return new JiraLoader();
    case 'confluence':
      return new ConfluenceLoader();
    case 'local':
      return new LocalFileLoader();
    default:
      throw new Error(`Unknown source type: ${sourceType}`);
  }
}

