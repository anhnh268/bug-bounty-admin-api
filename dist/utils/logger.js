"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.ConsoleLogger = void 0;
const config_1 = require("../config/config");
class ConsoleLogger {
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` ${JSON.stringify(context)}` : '';
        return `[${timestamp}] [${level}] ${message}${contextStr}`;
    }
    info(message, context) {
        console.log(this.formatMessage('INFO', message, context));
    }
    warn(message, context) {
        console.warn(this.formatMessage('WARN', message, context));
    }
    error(message, error, context) {
        const errorContext = {
            ...context,
            ...(error && {
                errorMessage: error.message,
                ...(config_1.isDevelopment && { stack: error.stack }),
            }),
        };
        console.error(this.formatMessage('ERROR', message, errorContext));
    }
    debug(message, context) {
        if (config_1.isDevelopment) {
            console.log(this.formatMessage('DEBUG', message, context));
        }
    }
}
exports.ConsoleLogger = ConsoleLogger;
exports.logger = new ConsoleLogger();
//# sourceMappingURL=logger.js.map