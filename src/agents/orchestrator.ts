import { getQAAgent, QAInput, QAOutput } from './qaAgent';
import { getSDETAgent, SDETInput, SDETOutput } from './sdetAgent';
import { getLogger, logPhase, logSuccess, logError } from '../utils/logger';
import { getEnvConfig } from '../utils/env';

const logger = getLogger();

export interface OrchestratorInput {
  userPrompt: string;
  ragSourcesPath?: string;
  featureName: string;
  mode?: 'full' | 'qa-only' | 'sdet-only';
}

export interface OrchestratorOutput {
  phase: number;
  qaOutput?: QAOutput;
  sdetOutput?: SDETOutput;
  success: boolean;
  message: string;
}

export enum Phase {
  INIT = 0,
  SCENARIO_DESIGN = 1,
  SETUP = 2,
  IMPLEMENTATION = 3,
  EXECUTION = 4,
  VALIDATION = 5,
  PR_CREATION = 6,
}

/**
 * Orchestrator - Coordinates QA and SDET agents through the workflow phases
 */
export class Orchestrator {
  private qaAgent = getQAAgent();
  private sdetAgent = getSDETAgent();
  private currentPhase: Phase = Phase.INIT;

  constructor() {
    logger.info('Orchestrator initialized');
  }

  /**
   * Execute the complete agentic workflow
   */
  async execute(input: OrchestratorInput): Promise<OrchestratorOutput> {
    logger.info('Orchestrator starting execution', {
      userPrompt: input.userPrompt,
      featureName: input.featureName,
      mode: input.mode || 'full',
    });

    const config = getEnvConfig();
    const mode = input.mode || 'full';

    try {
      // Phase 0: Initialize
      logPhase('Phase 0', 'Initialize & Plan');
      this.currentPhase = Phase.INIT;
      await this.phaseInit(input);

      // Phase 1: QA Agent - Scenario Design
      logPhase('Phase 1', 'Scenario Design (QA Agent)');
      this.currentPhase = Phase.SCENARIO_DESIGN;
      const qaOutput = await this.phaseScenarioDesign(input);
      logSuccess('Phase 1', `Generated ${qaOutput.scenariosPath}`);

      // Stop if QA-only mode
      if (mode === 'qa-only') {
        return {
          phase: this.currentPhase,
          qaOutput,
          success: true,
          message: 'QA Agent completed successfully. Scenarios generated.',
        };
      }

      // Phase 2: Setup (implicit, handled by SDET)
      logPhase('Phase 2', 'Repository & Tooling Setup');
      this.currentPhase = Phase.SETUP;
      await this.phaseSetup();

      // Phase 3: SDET Agent - Implementation
      logPhase('Phase 3', 'Test Implementation (SDET Agent)');
      this.currentPhase = Phase.IMPLEMENTATION;
      const sdetOutput = await this.phaseImplementation(input.featureName, qaOutput, config.testEnv.baseUrl);
      logSuccess('Phase 3', `Implemented ${sdetOutput.testFiles.length} test files`);

      // Phase 4: Execution & Debugging
      logPhase('Phase 4', 'Test Execution & Debugging');
      this.currentPhase = Phase.EXECUTION;
      await this.phaseExecution(sdetOutput);
      logSuccess('Phase 4', `Tests executed: ${sdetOutput.testResults.passed} passed, ${sdetOutput.testResults.failed} failed`);

      // Phase 5: Validation
      logPhase('Phase 5', 'Quality Gates & Validation');
      this.currentPhase = Phase.VALIDATION;
      const validationPassed = await this.phaseValidation(sdetOutput);
      
      if (!validationPassed) {
        return {
          phase: this.currentPhase,
          qaOutput,
          sdetOutput,
          success: false,
          message: 'Quality gates not passed. Please review test results and fix failures.',
        };
      }
      logSuccess('Phase 5', 'Quality gates passed');

      // Phase 6: PR Creation (optional, requires GitHub integration)
      logPhase('Phase 6', 'PR Creation (Optional)');
      this.currentPhase = Phase.PR_CREATION;
      // PR creation will be handled by PR workflow in Phase 7 implementation
      logSuccess('Phase 6', 'Ready for PR creation via prWorkflow');

      return {
        phase: this.currentPhase,
        qaOutput,
        sdetOutput,
        success: true,
        message: 'Agentic workflow completed successfully!',
      };

    } catch (error) {
      logError('Orchestrator', error as Error, {
        phase: this.currentPhase,
        featureName: input.featureName,
      });

      return {
        phase: this.currentPhase,
        success: false,
        message: `Workflow failed at Phase ${this.currentPhase}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Phase 0: Initialize
   */
  private async phaseInit(input: OrchestratorInput): Promise<void> {
    logger.info('Initializing workflow', {
      userPrompt: input.userPrompt.substring(0, 100),
      featureName: input.featureName,
    });

    // Validate environment
    const config = getEnvConfig();
    logger.info('Environment validated', {
      testEnv: config.testEnv.env,
      baseUrl: config.testEnv.baseUrl,
    });

    // Check gate: Required inputs present
    if (!input.userPrompt || !input.featureName) {
      throw new Error('Missing required inputs: userPrompt and featureName');
    }
  }

  /**
   * Phase 1: Scenario Design (QA Agent)
   */
  private async phaseScenarioDesign(input: OrchestratorInput): Promise<QAOutput> {
    logger.info('Starting scenario design phase');

    // Load RAG sources if provided
    let ragSources = {};
    if (input.ragSourcesPath) {
      const fs = await import('fs');
      const content = fs.readFileSync(input.ragSourcesPath, 'utf-8');
      ragSources = JSON.parse(content);
    }

    const qaInput: QAInput = {
      userPrompt: input.userPrompt,
      ragSources,
      featureName: input.featureName,
    };

    const qaOutput = await this.qaAgent.execute(qaInput);

    // Gate: Scenarios generated successfully
    if (!qaOutput.scenariosPath) {
      throw new Error('QA Agent failed to generate scenarios');
    }

    return qaOutput;
  }

  /**
   * Phase 2: Setup
   */
  private async phaseSetup(): Promise<void> {
    logger.info('Setup phase (Playwright configuration should exist)');
    
    // In a full implementation, this would:
    // - Verify playwright.config.ts exists
    // - Check that test directories are set up
    // - Validate fixtures are available
    
    // For now, just verify basic structure
    const fs = await import('fs');
    const path = await import('path');
    
    const requiredDirs = [
      'tests/e2e',
      'tests/fixtures',
      'src/pages',
    ];

    for (const dir of requiredDirs) {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    }
  }

  /**
   * Phase 3: Implementation (SDET Agent)
   */
  private async phaseImplementation(
    featureName: string,
    qaOutput: QAOutput,
    baseUrl: string
  ): Promise<SDETOutput> {
    logger.info('Starting implementation phase');

    const sdetInput: SDETInput = {
      featureName,
      scenariosPath: qaOutput.scenariosPath,
      baseUrl,
    };

    const sdetOutput = await this.sdetAgent.execute(sdetInput);

    // Gate: Test files created
    if (sdetOutput.testFiles.length === 0) {
      throw new Error('SDET Agent failed to generate test files');
    }

    return sdetOutput;
  }

  /**
   * Phase 4: Execution
   */
  private async phaseExecution(sdetOutput: SDETOutput): Promise<void> {
    logger.info('Execution phase completed by SDET Agent', {
      passed: sdetOutput.testResults.passed,
      failed: sdetOutput.testResults.failed,
    });

    // The SDET agent already executed tests, so we just validate the results exist
    if (!sdetOutput.testResults) {
      throw new Error('No test results available');
    }
  }

  /**
   * Phase 5: Validation (Quality Gates)
   */
  private async phaseValidation(sdetOutput: SDETOutput): Promise<boolean> {
    logger.info('Running quality gate validation');

    const gates = {
      allTestsPassing: sdetOutput.testResults.failed === 0,
      stableRuns: sdetOutput.stableRuns >= 2,
      hasTests: sdetOutput.testResults.total > 0,
    };

    logger.info('Quality gates check', gates);

    // All gates must pass
    const allPassed = Object.values(gates).every(g => g === true);

    if (!allPassed) {
      logger.warn('Quality gates failed', {
        failedTests: sdetOutput.testResults.failed,
        stableRuns: sdetOutput.stableRuns,
        totalTests: sdetOutput.testResults.total,
      });
    }

    return allPassed;
  }

  /**
   * Get current phase
   */
  getCurrentPhase(): Phase {
    return this.currentPhase;
  }

  /**
   * Get phase name
   */
  static getPhaseName(phase: Phase): string {
    const names = {
      [Phase.INIT]: 'Initialize & Plan',
      [Phase.SCENARIO_DESIGN]: 'Scenario Design',
      [Phase.SETUP]: 'Setup',
      [Phase.IMPLEMENTATION]: 'Implementation',
      [Phase.EXECUTION]: 'Execution',
      [Phase.VALIDATION]: 'Validation',
      [Phase.PR_CREATION]: 'PR Creation',
    };
    return names[phase] || 'Unknown';
  }
}

/**
 * Get Orchestrator singleton instance
 */
let orchestratorInstance: Orchestrator | null = null;

export function getOrchestrator(): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
  }
  return orchestratorInstance;
}

