import winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import { getEnvConfig } from './env';

/**
 * Create and configure Winston logger
 */
function createLogger() {
  const config = getEnvConfig();
  const logDir = path.dirname(config.logging.logFile);

  // Ensure log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logger = winston.createLogger({
    level: config.logging.level,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    defaultMeta: { service: 'agentic-playwright' },
    transports: [
      // File transport for all logs
      new winston.transports.File({
        filename: config.logging.logFile,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      // Separate file for errors
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5,
      }),
    ],
  });

  // Console transport for non-production
  if (config.nodeEnv !== 'production') {
    logger.add(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, ...metadata }) => {
            let msg = `${timestamp} [${level}]: ${message}`;
            if (Object.keys(metadata).length > 0 && metadata.service !== 'agentic-playwright') {
              msg += ` ${JSON.stringify(metadata)}`;
            }
            return msg;
          })
        ),
      })
    );
  }

  return logger;
}

// Singleton logger instance
let loggerInstance: winston.Logger | null = null;

/**
 * Get the logger instance
 */
export function getLogger(): winston.Logger {
  if (!loggerInstance) {
    loggerInstance = createLogger();
  }
  return loggerInstance;
}

/**
 * Log phase information
 */
export function logPhase(phase: string, message: string) {
  const logger = getLogger();
  logger.info(`[${phase}] ${message}`);
}

/**
 * Log agent action
 */
export function logAgentAction(agent: string, action: string, details?: Record<string, unknown>) {
  const logger = getLogger();
  logger.info(`[${agent}] ${action}`, details);
}

/**
 * Log error with context
 */
export function logError(context: string, error: Error | unknown, details?: Record<string, unknown>) {
  const logger = getLogger();
  if (error instanceof Error) {
    logger.error(`[${context}] ${error.message}`, {
      stack: error.stack,
      ...details,
    });
  } else {
    logger.error(`[${context}] Unknown error`, {
      error: String(error),
      ...details,
    });
  }
}

/**
 * Log success with context
 */
export function logSuccess(context: string, message: string, details?: Record<string, unknown>) {
  const logger = getLogger();
  logger.info(`[${context}] ✓ ${message}`, details);
}

/**
 * Log warning with context
 */
export function logWarning(context: string, message: string, details?: Record<string, unknown>) {
  const logger = getLogger();
  logger.warn(`[${context}] ${message}`, details);
}

/**
 * Create a child logger for a specific module
 */
export function createModuleLogger(moduleName: string) {
  return getLogger().child({ module: moduleName });
}

export default getLogger;

