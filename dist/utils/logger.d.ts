import { ILogger, ILogContext } from '../interfaces/logger.interface';
export declare class ConsoleLogger implements ILogger {
    private formatMessage;
    info(message: string, context?: ILogContext): void;
    warn(message: string, context?: ILogContext): void;
    error(message: string, error?: Error, context?: ILogContext): void;
    debug(message: string, context?: ILogContext): void;
}
export declare const logger: ILogger;
//# sourceMappingURL=logger.d.ts.map