export declare const API_CONSTANTS: {
    readonly DEFAULT_PAGE: 1;
    readonly DEFAULT_LIMIT: 20;
    readonly MAX_LIMIT: 100;
    readonly MIN_TITLE_LENGTH: 5;
    readonly MAX_TITLE_LENGTH: 200;
    readonly MIN_DESCRIPTION_LENGTH: 10;
    readonly MAX_DESCRIPTION_LENGTH: 5000;
    readonly MAX_IMPACT_LENGTH: 1000;
    readonly TOKEN_PREFIX: "Bearer ";
};
export declare const HTTP_STATUS: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly INTERNAL_SERVER_ERROR: 500;
};
export declare const ERROR_MESSAGES: {
    readonly REPORT_NOT_FOUND: "Report not found";
    readonly INVALID_TOKEN: "Invalid authentication token";
    readonly NO_TOKEN: "No authentication token provided";
    readonly INSUFFICIENT_PERMISSIONS: "Insufficient permissions";
    readonly VALIDATION_FAILED: "Validation failed";
    readonly INTERNAL_ERROR: "Internal server error";
    readonly CANNOT_ASSIGN_RESOLVED: "Cannot assign a resolved or rejected report";
};
//# sourceMappingURL=index.d.ts.map