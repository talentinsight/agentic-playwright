import { BaseAgent } from './baseAgent';
import { getRAG, RetrievalContext, RAGSourceConfig } from '../rag';
import { getLogger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger();

export interface QAInput {
  userPrompt: string;
  ragSources: RAGSourceConfig;
  featureName: string;
}

export interface QAOutput {
  requirementsDigest: string;
  testCharter: string;
  scenarios: string;
  scenariosPath: string;
}

export interface TestScenario {
  id: string;
  title: string;
  priority: 'p0' | 'p1' | 'p2';
  tags: string[];
  given: string[];
  when: string[];
  then: string[];
  testData?: Record<string, unknown>;
  citations: string[];
}

const QA_SYSTEM_PROMPT = `You are an expert QA Engineer specializing in test scenario design and requirements analysis.

Your responsibilities:
1. Analyze requirements from multiple sources (Jira, Confluence, documentation)
2. Extract acceptance criteria and non-functional requirements
3. Design comprehensive test scenarios using Given/When/Then format
4. Include positive, negative, edge case, and accessibility scenarios
5. Assign priority tags (@p0, @p1, @p2) and suite tags (@smoke, @regression, @a11y)
6. Define test data contracts and preconditions
7. Ensure traceability by citing sources for each requirement

Best Practices:
- Be thorough and detail-oriented
- Consider all user roles and permissions
- Think about error states and boundary conditions
- Ensure scenarios are testable and unambiguous
- Use clear, concise language
- Always cite sources with URLs or issue keys`;

/**
 * QA Agent - Responsible for requirements analysis and scenario generation
 */
export class QAAgent extends BaseAgent {
  private rag = getRAG();

  constructor() {
    super('QA Agent', QA_SYSTEM_PROMPT);
  }

  /**
   * Validate QA Agent state
   */
  protected async validate(): Promise<boolean> {
    // Check if RAG is initialized
    const hasDocuments = await this.rag.hasDocuments();
    if (!hasDocuments) {
      logger.warn('No documents indexed in RAG system');
    }
    return true;
  }

  /**
   * Execute QA Agent workflow
   */
  async execute(input: QAInput): Promise<QAOutput> {
    logger.info('QA Agent starting execution', {
      userPrompt: input.userPrompt,
      featureName: input.featureName,
    });

    // Initialize RAG
    await this.rag.initialize();

    // Index documents if sources provided
    if (Object.keys(input.ragSources).length > 0) {
      logger.info('Indexing RAG sources');
      await this.rag.indexDocuments(input.ragSources);
    }

    // Step 1: Analyze requirements
    const requirements = await this.analyzeRequirements(input.userPrompt, input.ragSources);

    // Step 2: Generate scenarios
    const scenarios = await this.generateScenarios(requirements);

    // Step 3: Add edge cases and negative scenarios
    const enhancedScenarios = await this.addEdgeCases(scenarios);

    // Step 4: Map to tags and priorities
    const taggedScenarios = await this.mapToTags(enhancedScenarios);

    // Step 5: Define test data
    const finalScenarios = await this.defineTestData(taggedScenarios);

    // Step 6: Write outputs to files
    const output = await this.writeOutputs(input.featureName, requirements, finalScenarios);

    logger.info('QA Agent execution complete', {
      scenariosGenerated: finalScenarios.length,
      outputPath: output.scenariosPath,
    });

    return output;
  }

  /**
   * Analyze requirements using RAG
   */
  async analyzeRequirements(userPrompt: string, ragSources: RAGSourceConfig): Promise<RetrievalContext> {
    logger.info('Analyzing requirements with RAG');

    const queries = [
      userPrompt,
      `${userPrompt} acceptance criteria`,
      `${userPrompt} requirements`,
      `${userPrompt} user stories`,
    ];

    const context = await this.rag.fetchMultiple(queries, {
      limit: 15,
      minScore: 0.3,
    });

    // Generate requirements digest using LLM
    const digestPrompt = `
Analyze the following requirements context and create a comprehensive requirements digest.

User Prompt: ${userPrompt}

Retrieved Context:
${context.formattedContext}

Citations:
${context.citations.map(c => `- [${c.source}] ${c.title || 'Untitled'} (${c.url || 'No URL'})`).join('\n')}

Please provide:
1. Executive summary (3-5 bullets)
2. Functional requirements with citations
3. Non-functional requirements (performance, a11y, security)
4. Edge cases and error conditions
5. Dependencies and prerequisites
6. Any assumptions or questions

Format as markdown.
`;

    const response = await this.chat(digestPrompt, { temperature: 0.5 });
    
    logger.info('Requirements digest generated');
    
    return context;
  }

  /**
   * Generate test scenarios from requirements
   */
  async generateScenarios(requirements: RetrievalContext): Promise<TestScenario[]> {
    logger.info('Generating test scenarios');

    const scenarioPrompt = `
Based on the requirements context provided, generate comprehensive test scenarios.

Requirements Context:
${requirements.formattedContext}

Generate scenarios in JSON format with the following structure:
[
  {
    "id": "AC-001",
    "title": "User can successfully log in with valid credentials",
    "priority": "p0",
    "tags": ["@smoke", "@authentication"],
    "given": ["User is on the login page", "User has valid credentials"],
    "when": ["User enters username and password", "User clicks login button"],
    "then": ["User is redirected to dashboard", "Welcome message is displayed"],
    "citations": ["JIRA-123", "DOC-456"]
  }
]

Generate at least 5-10 scenarios covering:
- Happy path (main user flows)
- Authentication and authorization
- Input validation
- Error handling
- Different user roles

Return ONLY the JSON array.
`;

    const response = await this.chat(scenarioPrompt, { temperature: 0.7 });
    const scenarios = this.parseJSON<TestScenario[]>(response.content);

    if (!scenarios || scenarios.length === 0) {
      logger.warn('Failed to parse scenarios, returning empty array');
      return [];
    }

    logger.info(`Generated ${scenarios.length} base scenarios`);
    return scenarios;
  }

  /**
   * Add edge cases and negative scenarios
   */
  async addEdgeCases(scenarios: TestScenario[]): Promise<TestScenario[]> {
    logger.info('Adding edge cases and negative scenarios');

    const edgeCasePrompt = `
Review the following test scenarios and add edge cases, negative scenarios, and boundary conditions.

Existing Scenarios:
${JSON.stringify(scenarios, null, 2)}

Add scenarios for:
- Invalid inputs and validation errors
- Boundary conditions (min/max values, empty strings, etc.)
- Network failures and timeouts
- Concurrent user actions
- Browser/device variations
- Accessibility considerations

Return the complete enhanced scenario array in JSON format (including original scenarios plus new ones).
Return ONLY the JSON array.
`;

    const response = await this.chat(edgeCasePrompt, { temperature: 0.7 });
    const enhancedScenarios = this.parseJSON<TestScenario[]>(response.content);

    if (!enhancedScenarios || enhancedScenarios.length === 0) {
      logger.warn('Failed to parse enhanced scenarios, returning original');
      return scenarios;
    }

    logger.info(`Enhanced to ${enhancedScenarios.length} scenarios (added ${enhancedScenarios.length - scenarios.length})`);
    return enhancedScenarios;
  }

  /**
   * Map scenarios to tags and priorities
   */
  async mapToTags(scenarios: TestScenario[]): Promise<TestScenario[]> {
    logger.info('Mapping scenarios to tags and priorities');

    const tagPrompt = `
Review the following scenarios and ensure proper priority and tag assignments.

Scenarios:
${JSON.stringify(scenarios, null, 2)}

Rules:
- @p0: Critical functionality, blocks release if fails
- @p1: Important functionality, should be tested
- @p2: Nice-to-have, optional

- @smoke: Core happy paths (5-10 most critical tests)
- @regression: Full feature coverage
- @a11y: Accessibility-related tests
- @negative: Error and validation scenarios
- @edge: Edge cases and boundary conditions

Update priorities and tags accordingly. Return the complete updated array in JSON format.
Return ONLY the JSON array.
`;

    const response = await this.chat(tagPrompt, { temperature: 0.5 });
    const taggedScenarios = this.parseJSON<TestScenario[]>(response.content);

    if (!taggedScenarios || taggedScenarios.length === 0) {
      logger.warn('Failed to parse tagged scenarios, returning original');
      return scenarios;
    }

    logger.info('Scenarios tagged successfully');
    return taggedScenarios;
  }

  /**
   * Define test data for scenarios
   */
  async defineTestData(scenarios: TestScenario[]): Promise<TestScenario[]> {
    logger.info('Defining test data for scenarios');

    const dataPrompt = `
Review the following scenarios and add test data contracts where applicable.

Scenarios:
${JSON.stringify(scenarios, null, 2)}

Add testData field with relevant inputs, expected outputs, and preconditions.
For example:
{
  "testData": {
    "input": {"username": "test@example.com", "password": "ValidPass123!"},
    "expected": {"redirectUrl": "/dashboard", "message": "Welcome back!"},
    "preconditions": {"userExists": true, "userActive": true}
  }
}

Return the complete updated array in JSON format.
Return ONLY the JSON array.
`;

    const response = await this.chat(dataPrompt, { temperature: 0.5 });
    const dataScenarios = this.parseJSON<TestScenario[]>(response.content);

    if (!dataScenarios || dataScenarios.length === 0) {
      logger.warn('Failed to parse scenarios with data, returning original');
      return scenarios;
    }

    logger.info('Test data defined for scenarios');
    return dataScenarios;
  }

  /**
   * Write outputs to files
   */
  async writeOutputs(featureName: string, requirements: RetrievalContext, scenarios: TestScenario[]): Promise<QAOutput> {
    const slug = featureName.toLowerCase().replace(/\s+/g, '-');
    const scenariosPath = path.join(process.cwd(), 'tests', '_plans', `${slug}.scenarios.md`);

    // Ensure directory exists
    const dir = path.dirname(scenariosPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Generate requirements digest
    const requirementsDigest = this.generateRequirementsDigest(featureName, requirements);

    // Generate test charter
    const testCharter = this.generateTestCharter(featureName, scenarios);

    // Generate scenarios document
    const scenariosDoc = this.generateScenariosDocument(featureName, scenarios);

    // Write files
    fs.writeFileSync(
      path.join(process.cwd(), 'docs', `requirements_digest_${slug}.md`),
      requirementsDigest
    );
    fs.writeFileSync(
      path.join(process.cwd(), 'docs', `test_charter_${slug}.md`),
      testCharter
    );
    fs.writeFileSync(scenariosPath, scenariosDoc);

    logger.info('Output files written', { scenariosPath });

    return {
      requirementsDigest,
      testCharter,
      scenarios: scenariosDoc,
      scenariosPath,
    };
  }

  /**
   * Generate requirements digest document
   */
  private generateRequirementsDigest(featureName: string, requirements: RetrievalContext): string {
    return `# Requirements Digest - ${featureName}

**Generated:** ${new Date().toISOString()}
**Feature:** ${featureName}

## Retrieved Context

${requirements.formattedContext}

## Citations

${requirements.citations.map(c => `- [${c.source}] ${c.title || 'Untitled'} - ${c.url || 'No URL'} (Score: ${c.relevanceScore.toFixed(2)})`).join('\n')}
`;
  }

  /**
   * Generate test charter document
   */
  private generateTestCharter(featureName: string, scenarios: TestScenario[]): string {
    const p0Count = scenarios.filter(s => s.priority === 'p0').length;
    const smokeCount = scenarios.filter(s => s.tags.includes('@smoke')).length;

    return `# Test Charter - ${featureName}

**Generated:** ${new Date().toISOString()}
**Total Scenarios:** ${scenarios.length}
**P0 Scenarios:** ${p0Count}
**Smoke Tests:** ${smokeCount}

## Scope

This test charter covers the ${featureName} feature with ${scenarios.length} comprehensive test scenarios.

## Coverage

- **Priority 0 (Critical):** ${p0Count} scenarios
- **Priority 1 (Important):** ${scenarios.filter(s => s.priority === 'p1').length} scenarios
- **Priority 2 (Optional):** ${scenarios.filter(s => s.priority === 'p2').length} scenarios

## Test Types

- **Smoke Tests:** ${smokeCount}
- **Regression Tests:** ${scenarios.filter(s => s.tags.includes('@regression')).length}
- **Accessibility Tests:** ${scenarios.filter(s => s.tags.includes('@a11y')).length}
- **Negative Tests:** ${scenarios.filter(s => s.tags.includes('@negative')).length}
- **Edge Cases:** ${scenarios.filter(s => s.tags.includes('@edge')).length}
`;
  }

  /**
   * Generate scenarios document
   */
  private generateScenariosDocument(featureName: string, scenarios: TestScenario[]): string {
    let doc = `# Test Scenarios - ${featureName}

**Generated:** ${new Date().toISOString()}
**Total Scenarios:** ${scenarios.length}

---

`;

    for (const scenario of scenarios) {
      doc += `## ${scenario.id}: ${scenario.title}

**Priority:** ${scenario.priority.toUpperCase()}  
**Tags:** ${scenario.tags.join(', ')}  
${scenario.citations.length > 0 ? `**Citations:** ${scenario.citations.join(', ')}` : ''}

### Given
${scenario.given.map(g => `- ${g}`).join('\n')}

### When
${scenario.when.map(w => `- ${w}`).join('\n')}

### Then
${scenario.then.map(t => `- ${t}`).join('\n')}

${scenario.testData ? `### Test Data
\`\`\`json
${JSON.stringify(scenario.testData, null, 2)}
\`\`\`
` : ''}

---

`;
    }

    return doc;
  }
}

/**
 * Get QA Agent singleton instance
 */
let qaAgentInstance: QAAgent | null = null;

export function getQAAgent(): QAAgent {
  if (!qaAgentInstance) {
    qaAgentInstance = new QAAgent();
  }
  return qaAgentInstance;
}

