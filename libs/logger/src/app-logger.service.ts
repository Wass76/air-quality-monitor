import { Injectable, LoggerService, Scope } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

type LogData = Record<string, unknown> | string;

function asLogText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value == null) {
    return '';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

/**
 * Lightweight Winston logger.
 * Transient scope so each inject site can set its own context.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService implements LoggerService {
  private context = 'Application';
  private readonly winstonLogger: winston.Logger;
  private static sharedWinstonLogger: winston.Logger | null = null;

  constructor() {
    this.winstonLogger = AppLoggerService.getOrCreateWinstonLogger();
  }

  private static getOrCreateWinstonLogger(): winston.Logger {
    if (AppLoggerService.sharedWinstonLogger) {
      return AppLoggerService.sharedWinstonLogger;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const logToFile = process.env.LOG_TO_FILE === 'true';

    const consoleFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.colorize({ all: true }),
      winston.format.printf((info) => {
        const timestamp = asLogText(info.timestamp);
        const level = asLogText(info.level);
        const message = asLogText(info.message);
        const context = info.context ? `[${asLogText(info.context)}] ` : '';
        const { service: _ignoredService, ...rest } = info;
        void _ignoredService;
        const metaKeys = Object.keys(rest).filter(
          (key) =>
            !['timestamp', 'level', 'message', 'context', 'splat'].includes(
              key,
            ),
        );
        const meta: Record<string, unknown> = {};
        for (const key of metaKeys) {
          meta[key] = rest[key];
        }
        const metaStr = metaKeys.length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level} ${context}${message}${metaStr}`;
      }),
    );

    const fileFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: isProduction ? fileFormat : consoleFormat,
        level: isProduction ? 'info' : 'debug',
      }),
    ];

    if (logToFile) {
      const logsDirectory = path.resolve(process.cwd(), 'logs');
      try {
        fs.mkdirSync(logsDirectory, { recursive: true });
      } catch (err) {
        console.error(`[AppLogger] Failed to create logs directory:`, err);
      }

      const appRotate = new DailyRotateFile({
        filename: path.join(logsDirectory, 'app-%DATE%.log'),
        auditFile: path.join(logsDirectory, '.app-audit.json'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: false,
        maxSize: '20m',
        maxFiles: '14d',
        format: fileFormat,
        level: 'info',
      });

      const errorRotate = new DailyRotateFile({
        filename: path.join(logsDirectory, 'error-%DATE%.log'),
        auditFile: path.join(logsDirectory, '.error-audit.json'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: false,
        maxSize: '20m',
        maxFiles: '14d',
        format: fileFormat,
        level: 'error',
      });

      for (const transport of [appRotate, errorRotate]) {
        transport.on('error', (err) => {
          console.error('[AppLogger] file transport error:', err);
        });
      }

      transports.push(appRotate, errorRotate);
    }

    AppLoggerService.sharedWinstonLogger = winston.createLogger({
      level: isProduction ? 'info' : 'debug',
      transports,
    });

    return AppLoggerService.sharedWinstonLogger;
  }

  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Nest's internal logger passes the context as a plain string second
   * argument, while app code passes a metadata object.
   */
  private buildMeta(data?: LogData): Record<string, unknown> {
    if (typeof data === 'string') {
      return { context: data };
    }
    return { context: this.context, ...data };
  }

  log(message: string, data?: LogData): void {
    this.winstonLogger.info(message, this.buildMeta(data));
  }

  error(message: string, trace?: string, context?: string): void {
    this.winstonLogger.error(message, {
      context: context || this.context,
      stack: trace,
    });
  }

  warn(message: string, data?: LogData): void {
    this.winstonLogger.warn(message, this.buildMeta(data));
  }

  debug(message: string, data?: LogData): void {
    this.winstonLogger.debug(message, this.buildMeta(data));
  }

  verbose(message: string, data?: LogData): void {
    this.winstonLogger.verbose(message, this.buildMeta(data));
  }
}
