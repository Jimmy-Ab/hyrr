import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private context?: string;

  setContext(context: string) {
    this.context = context;
  }

  private formatMessage(level: string, message: any, context?: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const ctx = context || this.context || 'Application';
    const logObj = {
      timestamp,
      level,
      context: ctx,
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      ...(meta ? { meta } : {}),
    };

    return JSON.stringify(logObj);
  }

  log(message: any, context?: string) {
    console.log(this.formatMessage('INFO', message, context));
  }

  error(message: any, trace?: string, context?: string) {
    console.error(this.formatMessage('ERROR', message, context, { trace }));
  }

  warn(message: any, context?: string) {
    console.warn(this.formatMessage('WARN', message, context));
  }

  debug(message: any, context?: string) {
    console.debug(this.formatMessage('DEBUG', message, context));
  }

  verbose(message: any, context?: string) {
    console.log(this.formatMessage('VERBOSE', message, context));
  }
}
