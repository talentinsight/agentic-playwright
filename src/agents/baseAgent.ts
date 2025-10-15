import OpenAI from 'openai';
import { getEnvConfig } from '../utils/env';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Base Agent class with LLM integration
 */
export abstract class BaseAgent {
  protected openai: OpenAI;
  protected model: string;
  protected messages: AgentMessage[] = [];
  protected systemPrompt: string;
  protected name: string;

  constructor(name: string, systemPrompt: string) {
    const config = getEnvConfig();
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.model = config.openai.model;
    this.name = name;
    this.systemPrompt = systemPrompt;

    // Initialize with system prompt
    this.messages.push({
      role: 'system',
      content: systemPrompt,
    });

    logger.info(`${this.name} initialized`);
  }

  /**
   * Send a message to the LLM
   */
  protected async chat(userMessage: string, options: {
    temperature?: number;
    maxTokens?: number;
  } = {}): Promise<AgentResponse> {
    this.messages.push({
      role: 'user',
      content: userMessage,
    });

    logger.debug(`${this.name} sending message to LLM`, {
      messageLength: userMessage.length,
    });

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: this.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4000,
      });

      const assistantMessage = response.choices[0].message.content || '';

      this.messages.push({
        role: 'assistant',
        content: assistantMessage,
      });

      logger.debug(`${this.name} received response from LLM`, {
        responseLength: assistantMessage.length,
        tokens: response.usage?.total_tokens,
      });

      return {
        content: assistantMessage,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      logger.error(`${this.name} LLM request failed`, { error });
      throw error;
    }
  }

  /**
   * Reset conversation history
   */
  protected resetConversation(): void {
    this.messages = [{
      role: 'system',
      content: this.systemPrompt,
    }];
    logger.debug(`${this.name} conversation reset`);
  }

  /**
   * Add context to the conversation
   */
  protected addContext(context: string): void {
    this.messages.push({
      role: 'user',
      content: context,
    });
  }

  /**
   * Get conversation history
   */
  protected getHistory(): AgentMessage[] {
    return [...this.messages];
  }

  /**
   * Format a prompt with template variables
   */
  protected formatPrompt(template: string, variables: Record<string, string>): string {
    let formatted = template;
    for (const [key, value] of Object.entries(variables)) {
      formatted = formatted.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return formatted;
  }

  /**
   * Extract code blocks from markdown
   */
  protected extractCodeBlocks(markdown: string, language?: string): string[] {
    const regex = language
      ? new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\`\`\``, 'g')
      : /```[\w]*\n([\s\S]*?)```/g;

    const matches: string[] = [];
    let match;

    while ((match = regex.exec(markdown)) !== null) {
      matches.push(match[1].trim());
    }

    return matches;
  }

  /**
   * Parse JSON from response
   */
  protected parseJSON<T = unknown>(content: string): T | null {
    try {
      // Try to extract JSON from markdown code blocks first
      const jsonBlocks = this.extractCodeBlocks(content, 'json');
      if (jsonBlocks.length > 0) {
        return JSON.parse(jsonBlocks[0]) as T;
      }

      // Try to parse the whole content
      return JSON.parse(content) as T;
    } catch (error) {
      logger.warn(`${this.name} failed to parse JSON from response`, { error });
      return null;
    }
  }

  /**
   * Validate agent state
   */
  protected abstract validate(): Promise<boolean>;

  /**
   * Execute the agent's main task
   */
  abstract execute(input: unknown): Promise<unknown>;

  /**
   * Get agent name
   */
  getName(): string {
    return this.name;
  }
}

