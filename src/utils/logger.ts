import { ILogger, ILogContext } from '../interfaces/logger.interface';
import { isDevelopment } from '../config/config';

export class ConsoleLogger implements ILogger {
  private formatMessage(level: string, message: string, context?: ILogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  info(message: string, context?: ILogContext): void {
    console.log(this.formatMessage('INFO', message, context));
  }

  warn(message: string, context?: ILogContext): void {
    console.warn(this.formatMessage('WARN', message, context));
  }

  error(message: string, error?: Error, context?: ILogContext): void {
    const errorContext = {
      ...context,
      ...(error && {
        errorMessage: error.message,
        ...(isDevelopment && { stack: error.stack }),
      }),
    };
    console.error(this.formatMessage('ERROR', message, errorContext));
  }

  debug(message: string, context?: ILogContext): void {
    if (isDevelopment) {
      console.log(this.formatMessage('DEBUG', message, context));
    }
  }
}

export const logger: ILogger = new ConsoleLogger();
