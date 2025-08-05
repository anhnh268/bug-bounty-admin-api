"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.errorHandler = exports.notFound = exports.AppError = void 0;
const zod_1 = require("zod");
const config_1 = require("../config/config");
const logger_1 = require("../utils/logger");
const constants_1 = require("../constants");
class AppError extends Error {
    statusCode;
    message;
    isOperational;
    constructor(statusCode, message, isOperational = true, stack = '') {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
        if (stack) {
            this.stack = stack;
        }
        else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
exports.AppError = AppError;
const notFound = (req, res) => {
    logger_1.logger.warn('404 - Not Found', {
        method: req.method,
        path: req.path,
        ip: req.ip,
    });
    const response = {
        success: false,
        error: 'Not Found',
        message: 'The requested resource was not found',
    };
    res.status(constants_1.HTTP_STATUS.NOT_FOUND).json(response);
};
exports.notFound = notFound;
const errorHandler = (err, req, res, _next) => {
    let statusCode = constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR;
    let message = constants_1.ERROR_MESSAGES.INTERNAL_ERROR;
    let error = 'Server Error';
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        error = err.name;
    }
    else if (err instanceof zod_1.ZodError) {
        statusCode = constants_1.HTTP_STATUS.BAD_REQUEST;
        error = 'Validation Error';
        message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    }
    else if (err instanceof Error) {
        message = config_1.isDevelopment ? err.message : 'Something went wrong';
    }
    logger_1.logger.error('Request error', err, {
        method: req.method,
        path: req.path,
        statusCode,
        userId: req.context?.user?.id,
        requestId: req.context?.requestId,
    });
    const response = {
        success: false,
        error,
        message,
    };
    if (config_1.isDevelopment && err instanceof Error) {
        response.stack = err.stack;
    }
    res.status(statusCode).json(response);
};
exports.errorHandler = errorHandler;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=error.middleware.js.map