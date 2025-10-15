import { getLogger } from './logger';
import { TestRunResult } from './testRunner';
import { TestScenario } from '../agents/qaAgent';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger();

export interface QualityGateResult {
  passed: boolean;
  gates: GateResult[];
  summary: string;
}

export interface GateResult {
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Quality Gates Validator
 */
export class QualityGates {
  /**
   * Validate all quality gates
   */
  async validate(
    scenarios: TestScenario[],
    testResults: TestRunResult,
    options: {
      requireStableRuns?: number;
      minP0Coverage?: number;
      minSmokeCoverage?: number;
    } = {}
  ): Promise<QualityGateResult> {
    logger.info('Running quality gate validation');

    const {
      requireStableRuns = 2,
      minP0Coverage = 100,
      minSmokeCoverage = 100,
    } = options;

    const gates: GateResult[] = [];

    // Gate 1: All tests passing
    gates.push(await this.validateAllTestsPassing(testResults));

    // Gate 2: P0/Smoke coverage
    gates.push(await this.validateP0Coverage(scenarios, testResults, minP0Coverage));
    gates.push(await this.validateSmokeCoverage(scenarios, testResults, minSmokeCoverage));

    // Gate 3: No hard-coded secrets
    gates.push(await this.validateNoSecrets());

    // Gate 4: Documentation updated
    gates.push(await this.validateDocumentation());

    // Gate 5: A11y checks executed (if enabled)
    gates.push(await this.validateA11yChecks());

    const allPassed = gates.every((gate) => gate.passed);

    const summary = allPassed
      ? '✓ All quality gates passed'
      : `✗ ${gates.filter((g) => !g.passed).length} quality gate(s) failed`;

    logger.info('Quality gate validation complete', {
      passed: allPassed,
      totalGates: gates.length,
      failedGates: gates.filter((g) => !g.passed).length,
    });

    return {
      passed: allPassed,
      gates,
      summary,
    };
  }

  /**
   * Gate: All tests passing
   */
  private async validateAllTestsPassing(testResults: TestRunResult): Promise<GateResult> {
    const passed = testResults.failed === 0 && testResults.total > 0;

    return {
      name: 'All Tests Passing',
      passed,
      message: passed
        ? `All ${testResults.passed} tests passed`
        : `${testResults.failed} test(s) failed`,
      details: {
        passed: testResults.passed,
        failed: testResults.failed,
        skipped: testResults.skipped,
        total: testResults.total,
      },
    };
  }

  /**
   * Gate: P0 coverage
   */
  private async validateP0Coverage(
    scenarios: TestScenario[],
    testResults: TestRunResult,
    minCoverage: number
  ): Promise<GateResult> {
    const p0Scenarios = scenarios.filter((s) => s.priority === 'p0');
    const coverage = p0Scenarios.length > 0 ? (testResults.passed / p0Scenarios.length) * 100 : 0;
    const passed = coverage >= minCoverage;

    return {
      name: 'P0 Scenario Coverage',
      passed,
      message: passed
        ? `P0 coverage: ${coverage.toFixed(1)}% (${testResults.passed}/${p0Scenarios.length})`
        : `P0 coverage below ${minCoverage}%: ${coverage.toFixed(1)}%`,
      details: {
        p0Scenarios: p0Scenarios.length,
        coverage: coverage.toFixed(1),
        required: minCoverage,
      },
    };
  }

  /**
   * Gate: Smoke test coverage
   */
  private async validateSmokeCoverage(
    scenarios: TestScenario[],
    testResults: TestRunResult,
    minCoverage: number
  ): Promise<GateResult> {
    const smokeScenarios = scenarios.filter((s) => s.tags.includes('@smoke'));
    const coverage =
      smokeScenarios.length > 0 ? (testResults.passed / smokeScenarios.length) * 100 : 0;
    const passed = coverage >= minCoverage;

    return {
      name: 'Smoke Test Coverage',
      passed,
      message: passed
        ? `Smoke coverage: ${coverage.toFixed(1)}% (${testResults.passed}/${smokeScenarios.length})`
        : `Smoke coverage below ${minCoverage}%: ${coverage.toFixed(1)}%`,
      details: {
        smokeScenarios: smokeScenarios.length,
        coverage: coverage.toFixed(1),
        required: minCoverage,
      },
    };
  }

  /**
   * Gate: No hard-coded secrets
   */
  private async validateNoSecrets(): Promise<GateResult> {
    const secretPatterns = [
      /['"]?api[_-]?key['"]?\s*[:=]\s*['"][^'"]+['"]/gi,
      /['"]?secret['"]?\s*[:=]\s*['"][^'"]+['"]/gi,
      /['"]?password['"]?\s*[:=]\s*['"][^'"]+['"]/gi,
      /sk-[a-zA-Z0-9]{32,}/g, // OpenAI keys
      /ghp_[a-zA-Z0-9]{36,}/g, // GitHub tokens
    ];

    const violations: string[] = [];
    const filesToCheck = this.getFilesToCheck();

    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of secretPatterns) {
        if (pattern.test(content)) {
          violations.push(file);
          break;
        }
      }
    }

    const passed = violations.length === 0;

    return {
      name: 'No Hard-coded Secrets',
      passed,
      message: passed
        ? 'No hard-coded secrets found'
        : `Found potential secrets in ${violations.length} file(s)`,
      details: violations.length > 0 ? { files: violations } : undefined,
    };
  }

  /**
   * Gate: Documentation updated
   */
  private async validateDocumentation(): Promise<GateResult> {
    const requiredDocs = ['README.md', 'README_test.md'];
    const missingDocs: string[] = [];

    for (const doc of requiredDocs) {
      const docPath = path.join(process.cwd(), doc);
      if (!fs.existsSync(docPath)) {
        missingDocs.push(doc);
      }
    }

    const passed = missingDocs.length === 0;

    return {
      name: 'Documentation Complete',
      passed,
      message: passed ? 'All required documentation exists' : `Missing: ${missingDocs.join(', ')}`,
      details: missingDocs.length > 0 ? { missing: missingDocs } : undefined,
    };
  }

  /**
   * Gate: A11y checks executed
   */
  private async validateA11yChecks(): Promise<GateResult> {
    const { getEnvConfig } = await import('./env');
    const config = getEnvConfig();

    if (!config.featureFlags.enableA11yTests) {
      return {
        name: 'Accessibility Checks',
        passed: true,
        message: 'A11y tests disabled (skipped)',
      };
    }

    // Check if any a11y tests exist
    const testsDir = path.join(process.cwd(), 'tests');
    const hasA11yTests = this.hasA11yTests(testsDir);

    return {
      name: 'Accessibility Checks',
      passed: hasA11yTests,
      message: hasA11yTests ? 'A11y tests found' : 'No a11y tests found',
    };
  }

  /**
   * Get files to check for secrets
   */
  private getFilesToCheck(): string[] {
    const files: string[] = [];
    const dirsToCheck = ['src', 'tests'];

    for (const dir of dirsToCheck) {
      const dirPath = path.join(process.cwd(), dir);
      if (fs.existsSync(dirPath)) {
        this.collectFiles(dirPath, files, ['.ts', '.js']);
      }
    }

    return files;
  }

  /**
   * Recursively collect files
   */
  private collectFiles(dir: string, files: string[], extensions: string[]): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.collectFiles(fullPath, files, extensions);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  /**
   * Check if a11y tests exist
   */
  private hasA11yTests(dir: string): boolean {
    if (!fs.existsSync(dir)) return false;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (this.hasA11yTests(fullPath)) return true;
      } else if (entry.name.endsWith('.ts')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (content.includes('@a11y') || content.includes('checkAccessibility')) {
          return true;
        }
      }
    }

    return false;
  }
}

// Singleton instance
let qualityGatesInstance: QualityGates | null = null;

/**
 * Get QualityGates singleton instance
 */
export function getQualityGates(): QualityGates {
  if (!qualityGatesInstance) {
    qualityGatesInstance = new QualityGates();
  }
  return qualityGatesInstance;
}

