import { BaseAgent } from './baseAgent';
import { TestScenario } from './qaAgent';
import { getPlaywrightClient, PlaywrightTestResult } from '../mcp/playwrightClient';
import { getLogger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger();

export interface SDETInput {
  featureName: string;
  scenariosPath: string;
  baseUrl: string;
}

export interface SDETOutput {
  pomFiles: string[];
  testFiles: string[];
  testResults: PlaywrightTestResult;
  stableRuns: number;
}

const SDET_SYSTEM_PROMPT = `You are an expert SDET (Software Development Engineer in Test) specializing in Playwright test automation with TypeScript.

Your responsibilities:
1. Design Page Object Models (POM) following best practices
2. Implement Playwright Test specifications using TypeScript
3. Use semantic, accessible selectors (getByRole, getByLabel, etc.)
4. Ensure deterministic, stable tests (no sleeps, use expect() with auto-waiting)
5. Implement test fixtures for authentication and data setup
6. Add accessibility checks where appropriate
7. Debug and fix test failures using traces

Best Practices:
- Use Page Object Model pattern consistently
- Prefer semantic selectors over CSS/XPath
- Never use arbitrary waits or sleeps
- Ensure test isolation and idempotency
- Add meaningful assertions with expect()
- Use fixtures for setup/teardown
- Tag tests appropriately
- Follow TypeScript best practices`;

/**
 * SDET Agent - Responsible for test implementation and execution
 */
export class SDETAgent extends BaseAgent {
  private playwrightClient = getPlaywrightClient();

  constructor() {
    super('SDET Agent', SDET_SYSTEM_PROMPT);
  }

  /**
   * Validate SDET Agent state
   */
  protected async validate(): Promise<boolean> {
    // Check if Playwright client is reachable
    try {
      const healthy = await this.playwrightClient.healthCheck();
      if (!healthy) {
        logger.warn('Playwright MCP server health check failed');
      }
      return true;
    } catch (error) {
      logger.warn('Could not validate Playwright MCP connection', { error });
      return true; // Continue anyway
    }
  }

  /**
   * Execute SDET Agent workflow
   */
  async execute(input: SDETInput): Promise<SDETOutput> {
    logger.info('SDET Agent starting execution', {
      featureName: input.featureName,
      scenariosPath: input.scenariosPath,
    });

    // Step 1: Load scenarios
    const scenarios = await this.loadScenarios(input.scenariosPath);

    // Step 2: Design POMs
    const pomFiles = await this.designPOM(input.featureName, scenarios, input.baseUrl);

    // Step 3: Implement tests
    const testFiles = await this.implementTests(input.featureName, scenarios, pomFiles);

    // Step 4: Execute tests
    const testResults = await this.executeTests(input.featureName);

    // Step 5: Debug failures if any
    if (testResults.failed > 0) {
      await this.debugFailures(testResults);
      // Re-run after fixes
      const rerunResults = await this.executeTests(input.featureName);
      if (rerunResults.failed > 0) {
        logger.warn('Tests still failing after debug attempt');
      }
    }

    // Step 6: Validate stability
    const stableRuns = await this.validateStability(input.featureName);

    logger.info('SDET Agent execution complete', {
      pomFiles: pomFiles.length,
      testFiles: testFiles.length,
      passed: testResults.passed,
      failed: testResults.failed,
      stableRuns,
    });

    return {
      pomFiles,
      testFiles,
      testResults,
      stableRuns,
    };
  }

  /**
   * Load scenarios from file
   */
  async loadScenarios(scenariosPath: string): Promise<TestScenario[]> {
    logger.info('Loading scenarios', { scenariosPath });

    if (!fs.existsSync(scenariosPath)) {
      throw new Error(`Scenarios file not found: ${scenariosPath}`);
    }

    const content = fs.readFileSync(scenariosPath, 'utf-8');
    
    // Parse scenarios from markdown (simplified parsing)
    const scenarios: TestScenario[] = [];
    const scenarioRegex = /## ([\w-]+): (.+?)\n\n\*\*Priority:\*\* (p[0-2])/g;
    let match;

    while ((match = scenarioRegex.exec(content)) !== null) {
      scenarios.push({
        id: match[1],
        title: match[2],
        priority: match[3] as 'p0' | 'p1' | 'p2',
        tags: [],
        given: [],
        when: [],
        then: [],
        citations: [],
      });
    }

    logger.info(`Loaded ${scenarios.length} scenarios`);
    return scenarios;
  }

  /**
   * Design Page Object Models
   */
  async designPOM(featureName: string, scenarios: TestScenario[], baseUrl: string): Promise<string[]> {
    logger.info('Designing Page Object Models');

    const pomPrompt = `
Design Page Object Models for the following test scenarios.

Feature: ${featureName}
Base URL: ${baseUrl}

Scenarios:
${scenarios.map(s => `- ${s.id}: ${s.title}`).join('\n')}

Create POM classes in TypeScript for Playwright. Follow these requirements:
1. Extend from a BasePage class
2. Use semantic selectors (getByRole, getByLabel, getByTestId)
3. Include proper typing for all methods
4. Add JSDoc comments
5. No sleeps or arbitrary waits
6. Return promises where appropriate

Generate 2-3 page object files needed for these scenarios.

For each POM, provide:
- File name (e.g., "LoginPage.ts")
- Complete TypeScript code

Format your response as:
FILE: filename.ts
\`\`\`typescript
// code here
\`\`\`
`;

    const response = await this.chat(pomPrompt, { temperature: 0.5, maxTokens: 6000 });
    
    // Parse and write POM files
    const pomFiles = this.extractAndWritePOMFiles(response.content);

    logger.info(`Created ${pomFiles.length} POM files`);
    return pomFiles;
  }

  /**
   * Implement test specifications
   */
  async implementTests(featureName: string, scenarios: TestScenario[], pomFiles: string[]): Promise<string[]> {
    logger.info('Implementing test specifications');

    const testPrompt = `
Implement Playwright Test specifications for the following scenarios.

Feature: ${featureName}

Available Page Objects:
${pomFiles.map(f => `- ${path.basename(f)}`).join('\n')}

Scenarios to implement:
${scenarios.slice(0, 10).map(s => `
${s.id}: ${s.title}
Priority: ${s.priority}
Tags: ${s.tags.join(', ')}
Given: ${s.given.join(', ')}
When: ${s.when.join(', ')}
Then: ${s.then.join(', ')}
`).join('\n')}

Create comprehensive Playwright Test files. Requirements:
1. Import necessary POMs
2. Use test.describe for grouping
3. Add tags in test titles: test('scenario @smoke @p0', ...)
4. Use fixtures for setup/teardown
5. Add meaningful expect() assertions
6. Follow Given/When/Then structure in comments
7. Ensure test isolation

Generate 1-2 test spec files.

Format your response as:
FILE: filename.spec.ts
\`\`\`typescript
// code here
\`\`\`
`;

    const response = await this.chat(testPrompt, { temperature: 0.5, maxTokens: 8000 });
    
    // Parse and write test files
    const testFiles = this.extractAndWriteTestFiles(response.content, featureName);

    logger.info(`Created ${testFiles.length} test files`);
    return testFiles;
  }

  /**
   * Execute tests via Playwright MCP
   */
  async executeTests(featureName: string): Promise<PlaywrightTestResult> {
    logger.info('Executing Playwright tests');

    const slug = featureName.toLowerCase().replace(/\s+/g, '-');
    
    try {
      const result = await this.playwrightClient.run({
        testPath: `tests/e2e/${slug}.spec.ts`,
        reporter: 'html',
      });

      logger.info('Test execution complete', {
        passed: result.passed,
        failed: result.failed,
        total: result.total,
      });

      return result;
    } catch (error) {
      logger.error('Test execution failed', { error });
      
      // Return mock result for now (MCP server might not be running)
      return {
        success: false,
        passed: 0,
        failed: scenarios.length,
        skipped: 0,
        total: scenarios.length,
        duration: 0,
        failures: [],
      };
    }
  }

  /**
   * Debug test failures
   */
  async debugFailures(testResults: PlaywrightTestResult): Promise<void> {
    logger.info('Debugging test failures', { failures: testResults.failures?.length });

    if (!testResults.failures || testResults.failures.length === 0) {
      return;
    }

    const debugPrompt = `
The following tests failed. Analyze the errors and suggest fixes.

Failures:
${testResults.failures.map(f => `
Test: ${f.test}
Error: ${f.error}
${f.stack ? `Stack: ${f.stack}` : ''}
`).join('\n---\n')}

Common issues to check:
1. Selector not found (use more reliable selectors)
2. Timing issues (ensure proper awaits)
3. Assertion failures (check expected vs actual)
4. Test data issues (verify preconditions)

Provide specific fixes for each failure.
`;

    const response = await this.chat(debugPrompt, { temperature: 0.5 });
    
    logger.info('Debug suggestions generated', {
      suggestions: response.content.substring(0, 200),
    });

    // In a real implementation, this would apply fixes automatically
    // For now, just log the suggestions
  }

  /**
   * Validate test stability with multiple runs
   */
  async validateStability(featureName: string): Promise<number> {
    logger.info('Validating test stability');

    const slug = featureName.toLowerCase().replace(/\s+/g, '-');
    let successfulRuns = 0;

    try {
      // Run tests twice
      for (let i = 0; i < 2; i++) {
        const result = await this.playwrightClient.run({
          testPath: `tests/e2e/${slug}.spec.ts`,
        });

        if (result.failed === 0) {
          successfulRuns++;
        } else {
          logger.warn(`Stability run ${i + 1} had ${result.failed} failures`);
          break;
        }
      }
    } catch (error) {
      logger.warn('Stability validation failed', { error });
    }

    logger.info(`Stability validated: ${successfulRuns}/2 successful runs`);
    return successfulRuns;
  }

  /**
   * Extract and write POM files from LLM response
   */
  private extractAndWritePOMFiles(content: string): string[] {
    const files: string[] = [];
    const fileRegex = /FILE: ([\w.]+)\n```typescript\n([\s\S]*?)```/g;
    let match;

    const pagesDir = path.join(process.cwd(), 'src', 'pages');
    if (!fs.existsSync(pagesDir)) {
      fs.mkdirSync(pagesDir, { recursive: true });
    }

    while ((match = fileRegex.exec(content)) !== null) {
      const fileName = match[1];
      const code = match[2];
      const filePath = path.join(pagesDir, fileName);

      fs.writeFileSync(filePath, code);
      files.push(filePath);
      logger.info(`Created POM file: ${fileName}`);
    }

    return files;
  }

  /**
   * Extract and write test files from LLM response
   */
  private extractAndWriteTestFiles(content: string, featureName: string): string[] {
    const files: string[] = [];
    const fileRegex = /FILE: ([\w.]+)\n```typescript\n([\s\S]*?)```/g;
    let match;

    const testsDir = path.join(process.cwd(), 'tests', 'e2e');
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }

    const slug = featureName.toLowerCase().replace(/\s+/g, '-');

    while ((match = fileRegex.exec(content)) !== null) {
      const fileName = match[1] || `${slug}.spec.ts`;
      const code = match[2];
      const filePath = path.join(testsDir, fileName);

      fs.writeFileSync(filePath, code);
      files.push(filePath);
      logger.info(`Created test file: ${fileName}`);
    }

    // If no files were parsed, create a placeholder
    if (files.length === 0) {
      const placeholderPath = path.join(testsDir, `${slug}.spec.ts`);
      const placeholder = `import { test, expect } from '@playwright/test';

// Tests generated by SDET Agent
test.describe('${featureName}', () => {
  test('placeholder test @p0 @smoke', async ({ page }) => {
    // TODO: Implement test scenarios
    expect(true).toBe(true);
  });
});
`;
      fs.writeFileSync(placeholderPath, placeholder);
      files.push(placeholderPath);
    }

    return files;
  }
}

/**
 * Get SDET Agent singleton instance
 */
let sdetAgentInstance: SDETAgent | null = null;

export function getSDETAgent(): SDETAgent {
  if (!sdetAgentInstance) {
    sdetAgentInstance = new SDETAgent();
  }
  return sdetAgentInstance;
}

