import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { getLogger } from './logger';

const execAsync = promisify(exec);
const logger = getLogger();

export interface TestRunOptions {
  testPath?: string;
  project?: string;
  grep?: string;
  grepInvert?: string;
  headed?: boolean;
  debug?: boolean;
  reporter?: string;
  workers?: number;
  retries?: number;
  timeout?: number;
  updateSnapshots?: boolean;
}

export interface TestRunResult {
  success: boolean;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number;
  exitCode: number;
  stdout: string;
  stderr: string;
  reportPath?: string;
  tracePaths?: string[];
}

/**
 * Test Runner - Executes Playwright tests via CLI
 */
export class TestRunner {
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  /**
   * Run Playwright tests
   */
  async run(options: TestRunOptions = {}): Promise<TestRunResult> {
    logger.info('Running Playwright tests', { options });

    const args = this.buildCommandArgs(options);
    const command = `npx playwright test ${args.join(' ')}`;

    logger.debug('Executing command', { command });

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.projectRoot,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      const duration = Date.now() - startTime;
      const result = this.parseOutput(stdout, stderr, 0, duration);

      logger.info('Test run completed', {
        passed: result.passed,
        failed: result.failed,
        duration: result.duration,
      });

      return result;
    } catch (error: unknown) {
      const execError = error as { code?: number; stdout?: string; stderr?: string };
      const duration = Date.now() - startTime;
      const result = this.parseOutput(
        execError.stdout || '',
        execError.stderr || '',
        execError.code || 1,
        duration
      );

      logger.warn('Test run completed with failures', {
        passed: result.passed,
        failed: result.failed,
        exitCode: result.exitCode,
      });

      return result;
    }
  }

  /**
   * Build command line arguments
   */
  private buildCommandArgs(options: TestRunOptions): string[] {
    const args: string[] = [];

    if (options.testPath) {
      args.push(options.testPath);
    }

    if (options.project) {
      args.push('--project', options.project);
    }

    if (options.grep) {
      args.push('--grep', `"${options.grep}"`);
    }

    if (options.grepInvert) {
      args.push('--grep-invert', `"${options.grepInvert}"`);
    }

    if (options.headed) {
      args.push('--headed');
    }

    if (options.debug) {
      args.push('--debug');
    }

    if (options.reporter) {
      args.push('--reporter', options.reporter);
    }

    if (options.workers !== undefined) {
      args.push('--workers', options.workers.toString());
    }

    if (options.retries !== undefined) {
      args.push('--retries', options.retries.toString());
    }

    if (options.timeout !== undefined) {
      args.push('--timeout', options.timeout.toString());
    }

    if (options.updateSnapshots) {
      args.push('--update-snapshots');
    }

    return args;
  }

  /**
   * Parse test output
   */
  private parseOutput(
    stdout: string,
    stderr: string,
    exitCode: number,
    duration: number
  ): TestRunResult {
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    // Parse Playwright output format
    const passedMatch = stdout.match(/(\d+) passed/);
    const failedMatch = stdout.match(/(\d+) failed/);
    const skippedMatch = stdout.match(/(\d+) skipped/);

    if (passedMatch) passed = parseInt(passedMatch[1], 10);
    if (failedMatch) failed = parseInt(failedMatch[1], 10);
    if (skippedMatch) skipped = parseInt(skippedMatch[1], 10);

    const total = passed + failed + skipped;

    // Find report path
    let reportPath: string | undefined;
    const reportMatch = stdout.match(/file:\/\/(.+?playwright-report.+?index\.html)/);
    if (reportMatch) {
      reportPath = reportMatch[1];
    }

    // Find trace paths
    const tracePaths: string[] = [];
    const traceRegex = /trace\.zip/g;
    let match;
    while ((match = traceRegex.exec(stdout)) !== null) {
      tracePaths.push(match[0]);
    }

    return {
      success: exitCode === 0 && failed === 0,
      passed,
      failed,
      skipped,
      total,
      duration,
      exitCode,
      stdout,
      stderr,
      reportPath,
      tracePaths,
    };
  }

  /**
   * Run tests with specific tags
   */
  async runByTag(tag: string, options: TestRunOptions = {}): Promise<TestRunResult> {
    return this.run({
      ...options,
      grep: tag,
    });
  }

  /**
   * Run smoke tests
   */
  async runSmoke(options: TestRunOptions = {}): Promise<TestRunResult> {
    return this.runByTag('@smoke', options);
  }

  /**
   * Run regression tests
   */
  async runRegression(options: TestRunOptions = {}): Promise<TestRunResult> {
    return this.runByTag('@regression', options);
  }

  /**
   * Run accessibility tests
   */
  async runA11y(options: TestRunOptions = {}): Promise<TestRunResult> {
    return this.runByTag('@a11y', options);
  }

  /**
   * Get last test results from JSON reporter
   */
  async getLastResults(): Promise<TestRunResult | null> {
    const resultsPath = path.join(this.projectRoot, 'test-results', 'results.json');

    if (!fs.existsSync(resultsPath)) {
      logger.warn('No test results file found');
      return null;
    }

    try {
      const content = fs.readFileSync(resultsPath, 'utf-8');
      const data = JSON.parse(content);

      // Parse Playwright JSON reporter format
      const stats = data.stats || {};

      return {
        success: stats.failures === 0,
        passed: stats.expected || 0,
        failed: stats.unexpected || 0,
        skipped: stats.skipped || 0,
        total: (stats.expected || 0) + (stats.unexpected || 0) + (stats.skipped || 0),
        duration: stats.duration || 0,
        exitCode: stats.failures > 0 ? 1 : 0,
        stdout: '',
        stderr: '',
      };
    } catch (error) {
      logger.error('Failed to parse test results', { error });
      return null;
    }
  }

  /**
   * Show HTML report
   */
  async showReport(): Promise<void> {
    logger.info('Opening HTML report');

    try {
      await execAsync('npx playwright show-report', {
        cwd: this.projectRoot,
      });
    } catch (error) {
      logger.error('Failed to open HTML report', { error });
      throw error;
    }
  }

  /**
   * Show trace for a specific test
   */
  async showTrace(tracePath: string): Promise<void> {
    logger.info('Opening trace viewer', { tracePath });

    try {
      await execAsync(`npx playwright show-trace ${tracePath}`, {
        cwd: this.projectRoot,
      });
    } catch (error) {
      logger.error('Failed to open trace', { error });
      throw error;
    }
  }
}

// Singleton instance
let testRunnerInstance: TestRunner | null = null;

/**
 * Get TestRunner singleton instance
 */
export function getTestRunner(): TestRunner {
  if (!testRunnerInstance) {
    testRunnerInstance = new TestRunner();
  }
  return testRunnerInstance;
}

