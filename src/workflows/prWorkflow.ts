import { getGitHubClient } from '../mcp/githubClient';
import { getQualityGates, QualityGateResult } from '../utils/qualityGates';
import { getReportGenerator } from '../utils/reportGenerator';
import { getLogger } from '../utils/logger';
import { TestScenario } from '../agents/qaAgent';
import { TestRunResult } from '../utils/testRunner';
import { Citation } from '../rag/retriever';

const logger = getLogger();

export interface PRWorkflowInput {
  featureName: string;
  branchName: string;
  scenarios: TestScenario[];
  testResults: TestRunResult;
  citations?: Citation[];
}

export interface PRWorkflowOutput {
  prNumber: number;
  prUrl: string;
  qualityGates: QualityGateResult;
}

/**
 * PR Workflow - Handles automated PR creation
 */
export class PRWorkflow {
  private github = getGitHubClient();
  private qualityGates = getQualityGates();
  private reportGenerator = getReportGenerator();

  /**
   * Execute PR workflow
   */
  async execute(input: PRWorkflowInput): Promise<PRWorkflowOutput> {
    logger.info('Starting PR workflow', { featureName: input.featureName });

    // Step 1: Run quality gates
    const qualityGateResult = await this.qualityGates.validate(
      input.scenarios,
      input.testResults
    );

    if (!qualityGateResult.passed) {
      throw new Error(
        `Quality gates failed:\n${qualityGateResult.gates
          .filter((g) => !g.passed)
          .map((g) => `  - ${g.name}: ${g.message}`)
          .join('\n')}`
      );
    }

    logger.info('Quality gates passed');

    // Step 2: Generate coverage report
    const coverageReport = this.reportGenerator.generateCoverageReport(
      input.featureName,
      input.scenarios,
      input.testResults
    );

    // Step 3: Generate PR body
    const prBody = await this.generatePRBody(
      input.featureName,
      coverageReport,
      input.testResults,
      input.citations,
      qualityGateResult
    );

    // Step 4: Create PR
    const pr = await this.github.openPR({
      title: `test: ${input.featureName} e2e coverage (Playwright)`,
      body: prBody,
      head: input.branchName,
      labels: ['e2e', 'playwright', 'qa', 'automated'],
    });

    logger.info('PR created successfully', { prNumber: pr.number, prUrl: pr.url });

    return {
      prNumber: pr.number,
      prUrl: pr.url,
      qualityGates: qualityGateResult,
    };
  }

  /**
   * Generate PR body content
   */
  private async generatePRBody(
    featureName: string,
    coverageReport: ReturnType<typeof this.reportGenerator.generateCoverageReport>,
    testResults: TestRunResult,
    citations?: Citation[],
    qualityGates?: QualityGateResult
  ): Promise<string> {
    let body = `## 🎭 ${featureName} - E2E Test Coverage\n\n`;

    body += `This PR adds comprehensive Playwright test coverage for the **${featureName}** feature.\n\n`;

    // Summary
    body += `### 📊 Summary\n\n`;
    body += `- **Total Scenarios:** ${coverageReport.totalScenarios}\n`;
    body += `- **Coverage:** ${coverageReport.coveragePercentage.toFixed(1)}%\n`;
    body += `- **Tests Passed:** ${coverageReport.passedScenarios} ✅\n`;
    body += `- **Tests Failed:** ${coverageReport.failedScenarios} ❌\n`;
    body += `- **Duration:** ${(testResults.duration / 1000).toFixed(2)}s\n\n`;

    // Quality Gates
    if (qualityGates) {
      body += `### ✓ Quality Gates\n\n`;
      for (const gate of qualityGates.gates) {
        const icon = gate.passed ? '✅' : '❌';
        body += `${icon} **${gate.name}:** ${gate.message}\n`;
      }
      body += `\n`;
    }

    // Scenario Coverage Table
    body += `### 📋 Scenario Coverage\n\n`;
    body += `<details>\n<summary>View all scenarios (${coverageReport.scenarios.length})</summary>\n\n`;
    body += `| ID | Title | Priority | Status |\n`;
    body += `|----|-------|----------|--------|\n`;

    for (const scenario of coverageReport.scenarios) {
      const statusIcon = this.getStatusIcon(scenario.status);
      body += `| ${scenario.id} | ${scenario.title} | ${scenario.priority.toUpperCase()} | ${statusIcon} |\n`;
    }

    body += `\n</details>\n\n`;

    // How to Run
    body += `### 🚀 How to Run\n\n`;
    body += `\`\`\`bash\n`;
    body += `# Run all tests\n`;
    body += `npm test\n\n`;
    body += `# Run smoke tests only\n`;
    body += `npm test -- --grep @smoke\n\n`;
    body += `# Run in headed mode\n`;
    body += `npm run test:headed\n`;
    body += `\`\`\`\n\n`;

    // Citations
    if (citations && citations.length > 0) {
      body += `### 📚 Requirements Traceability\n\n`;
      body += `Test scenarios are derived from:\n\n`;
      for (const citation of citations.slice(0, 10)) {
        body += `- **[${citation.source}]** ${citation.title || 'Untitled'}`;
        if (citation.url) {
          body += ` ([View](${citation.url}))`;
        }
        body += `\n`;
      }
      if (citations.length > 10) {
        body += `\n_...and ${citations.length - 10} more sources_\n`;
      }
      body += `\n`;
    }

    // Footer
    body += `---\n\n`;
    body += `🤖 _This PR was automatically generated by the Agentic Playwright framework._\n`;

    return body;
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'passed':
        return '✅';
      case 'failed':
        return '❌';
      case 'skipped':
        return '⊘';
      default:
        return '○';
    }
  }
}

// Singleton instance
let prWorkflowInstance: PRWorkflow | null = null;

/**
 * Get PRWorkflow singleton instance
 */
export function getPRWorkflow(): PRWorkflow {
  if (!prWorkflowInstance) {
    prWorkflowInstance = new PRWorkflow();
  }
  return prWorkflowInstance;
}

