"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_MESSAGES = exports.HTTP_STATUS = exports.API_CONSTANTS = void 0;
exports.API_CONSTANTS = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MIN_TITLE_LENGTH: 5,
    MAX_TITLE_LENGTH: 200,
    MIN_DESCRIPTION_LENGTH: 10,
    MAX_DESCRIPTION_LENGTH: 5000,
    MAX_IMPACT_LENGTH: 1000,
    TOKEN_PREFIX: 'Bearer ',
};
exports.HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
};
exports.ERROR_MESSAGES = {
    REPORT_NOT_FOUND: 'Report not found',
    INVALID_TOKEN: 'Invalid authentication token',
    NO_TOKEN: 'No authentication token provided',
    INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
    VALIDATION_FAILED: 'Validation failed',
    INTERNAL_ERROR: 'Internal server error',
    CANNOT_ASSIGN_RESOLVED: 'Cannot assign a resolved or rejected report',
};
//# sourceMappingURL=index.js.map