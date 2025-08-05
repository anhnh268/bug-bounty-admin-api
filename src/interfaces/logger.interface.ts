export interface ILogContext {
  [key: string]: any;
}

export interface ILogger {
  info(message: string, context?: ILogContext): void;
  warn(message: string, context?: ILogContext): void;
  error(message: string, error?: Error, context?: ILogContext): void;
  debug(message: string, context?: ILogContext): void;
}
