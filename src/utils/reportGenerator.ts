import * as fs from 'fs';
import * as path from 'path';
import { getLogger } from './logger';
import { TestScenario } from '../agents/qaAgent';
import { TestRunResult } from './testRunner';
import { Citation } from '../rag/retriever';

const logger = getLogger();

export interface CoverageReport {
  featureName: string;
  totalScenarios: number;
  implementedScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  skippedScenarios: number;
  coveragePercentage: number;
  scenarios: ScenarioCoverage[];
}

export interface ScenarioCoverage {
  id: string;
  title: string;
  priority: string;
  tags: string[];
  status: 'passed' | 'failed' | 'skipped' | 'not-implemented';
  duration?: number;
  error?: string;
}

/**
 * Report Generator - Creates comprehensive test reports
 */
export class ReportGenerator {
  /**
   * Generate coverage report
   */
  generateCoverageReport(
    featureName: string,
    scenarios: TestScenario[],
    testResults: TestRunResult
  ): CoverageReport {
    logger.info('Generating coverage report', { featureName });

    const scenarioCoverage: ScenarioCoverage[] = scenarios.map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      priority: scenario.priority,
      tags: scenario.tags,
      status: this.determineScenarioStatus(scenario, testResults),
    }));

    const passed = scenarioCoverage.filter((s) => s.status === 'passed').length;
    const failed = scenarioCoverage.filter((s) => s.status === 'failed').length;
    const skipped = scenarioCoverage.filter((s) => s.status === 'skipped').length;
    const implemented = passed + failed;

    return {
      featureName,
      totalScenarios: scenarios.length,
      implementedScenarios: implemented,
      passedScenarios: passed,
      failedScenarios: failed,
      skippedScenarios: skipped,
      coveragePercentage: (implemented / scenarios.length) * 100,
      scenarios: scenarioCoverage,
    };
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(
    coverageReport: CoverageReport,
    testResults: TestRunResult,
    citations?: Citation[]
  ): string {
    let md = `# Test Report - ${coverageReport.featureName}\n\n`;
    md += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Summary
    md += `## Summary\n\n`;
    md += `- **Total Scenarios:** ${coverageReport.totalScenarios}\n`;
    md += `- **Implemented:** ${coverageReport.implementedScenarios} (${coverageReport.coveragePercentage.toFixed(1)}%)\n`;
    md += `- **Passed:** ${coverageReport.passedScenarios} ✓\n`;
    md += `- **Failed:** ${coverageReport.failedScenarios} ✗\n`;
    md += `- **Skipped:** ${coverageReport.skippedScenarios} ⊘\n`;
    md += `- **Duration:** ${(testResults.duration / 1000).toFixed(2)}s\n\n`;

    // Coverage Table
    md += `## Scenario Coverage\n\n`;
    md += `| ID | Title | Priority | Tags | Status |\n`;
    md += `|----|-------|----------|------|--------|\n`;

    for (const scenario of coverageReport.scenarios) {
      const statusIcon = this.getStatusIcon(scenario.status);
      const tags = scenario.tags.join(', ');
      md += `| ${scenario.id} | ${scenario.title} | ${scenario.priority.toUpperCase()} | ${tags} | ${statusIcon} ${scenario.status} |\n`;
    }

    md += `\n`;

    // Citations
    if (citations && citations.length > 0) {
      md += `## Requirements Traceability\n\n`;
      md += `Test scenarios are derived from the following sources:\n\n`;

      for (const citation of citations) {
        md += `- **[${citation.source}]** ${citation.title || 'Untitled'}`;
        if (citation.url) {
          md += ` - [View](${citation.url})`;
        }
        md += `\n`;
      }

      md += `\n`;
    }

    // Test Results
    md += `## Test Execution Results\n\n`;
    md += `\`\`\`\n`;
    md += `Passed:  ${testResults.passed}\n`;
    md += `Failed:  ${testResults.failed}\n`;
    md += `Skipped: ${testResults.skipped}\n`;
    md += `Total:   ${testResults.total}\n`;
    md += `\`\`\`\n\n`;

    if (testResults.reportPath) {
      md += `**HTML Report:** [View Report](${testResults.reportPath})\n\n`;
    }

    return md;
  }

  /**
   * Generate HTML report summary (for PR comments)
   */
  generateHTMLSummary(coverageReport: CoverageReport, testResults: TestRunResult): string {
    const passRate = (testResults.passed / testResults.total) * 100;
    const statusEmoji = passRate === 100 ? '✅' : passRate >= 80 ? '⚠️' : '❌';

    let html = `<h2>${statusEmoji} Test Report - ${coverageReport.featureName}</h2>\n`;
    html += `<table>\n`;
    html += `<tr><th>Metric</th><th>Value</th></tr>\n`;
    html += `<tr><td>Total Scenarios</td><td>${coverageReport.totalScenarios}</td></tr>\n`;
    html += `<tr><td>Coverage</td><td>${coverageReport.coveragePercentage.toFixed(1)}%</td></tr>\n`;
    html += `<tr><td>✅ Passed</td><td>${coverageReport.passedScenarios}</td></tr>\n`;
    html += `<tr><td>❌ Failed</td><td>${coverageReport.failedScenarios}</td></tr>\n`;
    html += `<tr><td>⊘ Skipped</td><td>${coverageReport.skippedScenarios}</td></tr>\n`;
    html += `<tr><td>⏱️ Duration</td><td>${(testResults.duration / 1000).toFixed(2)}s</td></tr>\n`;
    html += `</table>\n`;

    return html;
  }

  /**
   * Save report to file
   */
  async saveReport(content: string, outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, content, 'utf-8');
    logger.info('Report saved', { outputPath });
  }

  /**
   * Collect artifacts (reports, traces, screenshots)
   */
  async collectArtifacts(testResults: TestRunResult): Promise<string[]> {
    const artifacts: string[] = [];

    // HTML report
    if (testResults.reportPath && fs.existsSync(testResults.reportPath)) {
      artifacts.push(testResults.reportPath);
    }

    // Trace files
    const testResultsDir = path.join(process.cwd(), 'test-results');
    if (fs.existsSync(testResultsDir)) {
      const files = fs.readdirSync(testResultsDir, { recursive: true });
      for (const file of files) {
        if (typeof file === 'string' && (file.endsWith('.zip') || file.endsWith('.png'))) {
          artifacts.push(path.join(testResultsDir, file));
        }
      }
    }

    logger.info('Artifacts collected', { count: artifacts.length });
    return artifacts;
  }

  /**
   * Determine scenario status based on test results
   */
  private determineScenarioStatus(
    _scenario: TestScenario,
    testResults: TestRunResult
  ): 'passed' | 'failed' | 'skipped' | 'not-implemented' {
    // This is a simplified implementation
    // In a real scenario, you'd match test results to scenario IDs
    if (testResults.failed > 0) {
      return 'failed';
    }
    if (testResults.passed > 0) {
      return 'passed';
    }
    return 'not-implemented';
  }

  /**
   * Get status icon
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'passed':
        return '✓';
      case 'failed':
        return '✗';
      case 'skipped':
        return '⊘';
      default:
        return '○';
    }
  }
}

// Singleton instance
let reportGeneratorInstance: ReportGenerator | null = null;

/**
 * Get ReportGenerator singleton instance
 */
export function getReportGenerator(): ReportGenerator {
  if (!reportGeneratorInstance) {
    reportGeneratorInstance = new ReportGenerator();
  }
  return reportGeneratorInstance;
}

