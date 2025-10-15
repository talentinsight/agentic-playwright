import * as fs from 'fs';
import * as path from 'path';
import { getLogger } from './logger';

const logger = getLogger();

/**
 * Documentation Generator
 */
export class DocGenerator {
  /**
   * Update README_test.md with test information
   */
  async updateTestReadme(_featureName: string, scenarios: unknown[]): Promise<void> {
    const readmePath = path.join(process.cwd(), 'README_test.md');
    
    let content = `# Test Execution Guide\n\n`;
    content += `## Running Tests\n\n`;
    content += `### All Tests\n\`\`\`bash\nnpm test\n\`\`\`\n\n`;
    content += `### By Tag\n\`\`\`bash\n`;
    content += `npm test -- --grep @smoke\n`;
    content += `npm test -- --grep @regression\n`;
    content += `npm test -- --grep @a11y\n\`\`\`\n\n`;
    content += `### CI Mode\n\`\`\`bash\nnpm run test:ci\n\`\`\`\n\n`;
    content += `## Environment Variables\n\n`;
    content += `See \`.env.example\` for all configuration options.\n\n`;
    content += `## Generated Test Scenarios: ${scenarios.length}\n`;

    fs.writeFileSync(readmePath, content);
    logger.info('README_test.md updated');
  }

  /**
   * Generate changelog entry
   */
  async generateChangelogEntry(featureName: string): Promise<void> {
    const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
    const date = new Date().toISOString().split('T')[0];
    
    const entry = `\n## [${date}] - ${featureName}\n\n### Added\n- E2E test coverage for ${featureName}\n`;
    
    if (fs.existsSync(changelogPath)) {
      const existing = fs.readFileSync(changelogPath, 'utf-8');
      fs.writeFileSync(changelogPath, entry + existing);
    } else {
      fs.writeFileSync(changelogPath, `# Changelog\n${entry}`);
    }
    
    logger.info('Changelog entry added');
  }
}

export function getDocGenerator(): DocGenerator {
  return new DocGenerator();
}

