import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { getLogger } from './logger';
import { getEnvConfig } from './env';

const logger = getLogger();

export interface A11yViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
}

export interface A11yResults {
  violations: A11yViolation[];
  passes: number;
  incomplete: number;
  url: string;
  timestamp: string;
}

/**
 * Run accessibility checks on a page
 */
export async function checkAccessibility(
  page: Page,
  options: {
    includeTags?: string[];
    excludeTags?: string[];
    rules?: Record<string, { enabled: boolean }>;
  } = {}
): Promise<A11yResults> {
  const config = getEnvConfig();

  if (!config.featureFlags.enableA11yTests) {
    logger.info('Accessibility tests disabled');
    return {
      violations: [],
      passes: 0,
      incomplete: 0,
      url: page.url(),
      timestamp: new Date().toISOString(),
    };
  }

  logger.info('Running accessibility checks', { url: page.url() });

  const builder = new AxeBuilder({ page });

  // Configure tags
  if (options.includeTags) {
    builder.withTags(options.includeTags);
  }

  if (options.excludeTags) {
    for (const tag of options.excludeTags) {
      builder.disableTags([tag]);
    }
  }

  // Configure rules
  if (options.rules) {
    for (const [ruleId, config] of Object.entries(options.rules)) {
      if (!config.enabled) {
        builder.disableRules([ruleId]);
      }
    }
  }

  try {
    const results = await builder.analyze();

    logger.info('Accessibility check complete', {
      violations: results.violations.length,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
    });

    return {
      violations: results.violations as A11yViolation[],
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      url: page.url(),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Accessibility check failed', { error });
    throw error;
  }
}

/**
 * Check accessibility and assert no violations
 */
export async function assertNoA11yViolations(
  page: Page,
  options: {
    includeTags?: string[];
    excludeTags?: string[];
    rules?: Record<string, { enabled: boolean }>;
    allowedViolations?: string[];
  } = {}
): Promise<void> {
  const results = await checkAccessibility(page, options);

  // Filter out allowed violations
  const actualViolations = options.allowedViolations
    ? results.violations.filter((v) => !options.allowedViolations!.includes(v.id))
    : results.violations;

  if (actualViolations.length > 0) {
    const summary = formatViolationsSummary(actualViolations);
    throw new Error(`Accessibility violations found:\n${summary}`);
  }
}

/**
 * Check WCAG 2.1 Level AA compliance
 */
export async function checkWCAG21AA(page: Page): Promise<A11yResults> {
  return checkAccessibility(page, {
    includeTags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  });
}

/**
 * Check only critical and serious violations
 */
export async function checkCriticalA11y(page: Page): Promise<A11yResults> {
  const results = await checkAccessibility(page);

  return {
    ...results,
    violations: results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    ),
  };
}

/**
 * Format violations for readable output
 */
export function formatViolationsSummary(violations: A11yViolation[]): string {
  const lines: string[] = [];

  for (const violation of violations) {
    lines.push(`\n[${violation.impact.toUpperCase()}] ${violation.id}: ${violation.help}`);
    lines.push(`  Description: ${violation.description}`);
    lines.push(`  Help URL: ${violation.helpUrl}`);
    lines.push(`  Affected elements: ${violation.nodes.length}`);

    for (const node of violation.nodes.slice(0, 3)) {
      // Show first 3
      lines.push(`    - ${node.target.join(' > ')}`);
      lines.push(`      ${node.failureSummary}`);
    }

    if (violation.nodes.length > 3) {
      lines.push(`    ... and ${violation.nodes.length - 3} more`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate accessibility report
 */
export async function generateA11yReport(
  results: A11yResults,
  outputPath: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  const report = {
    summary: {
      url: results.url,
      timestamp: results.timestamp,
      violations: results.violations.length,
      passes: results.passes,
      incomplete: results.incomplete,
    },
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      affectedElements: v.nodes.length,
      examples: v.nodes.slice(0, 3).map((n) => ({
        target: n.target,
        html: n.html,
        summary: n.failureSummary,
      })),
    })),
  };

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  logger.info('Accessibility report generated', { outputPath });
}

/**
 * Check keyboard navigation
 */
export async function checkKeyboardNavigation(page: Page): Promise<{
  success: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    // Check if all interactive elements are reachable via Tab
    const interactiveElements = await page.locator(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ).all();

    logger.info(`Found ${interactiveElements.length} interactive elements`);

    // Try to tab through elements
    for (let i = 0; i < Math.min(interactiveElements.length, 20); i++) {
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName,
          id: el?.id,
          class: el?.className,
        };
      });

      if (!focusedElement.tag) {
        issues.push(`Tab ${i + 1}: No element received focus`);
      }
    }

    return {
      success: issues.length === 0,
      issues,
    };
  } catch (error) {
    logger.error('Keyboard navigation check failed', { error });
    return {
      success: false,
      issues: [`Check failed: ${error}`],
    };
  }
}

/**
 * Check color contrast
 */
export async function checkColorContrast(page: Page): Promise<A11yResults> {
  return checkAccessibility(page, {
    includeTags: ['cat.color'],
  });
}

/**
 * Check form labels
 */
export async function checkFormLabels(page: Page): Promise<A11yResults> {
  return checkAccessibility(page, {
    rules: {
      label: { enabled: true },
      'label-title-only': { enabled: true },
    },
  });
}

