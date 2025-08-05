"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeHtml = exports.validateRequest = void 0;
const zod_1 = require("zod");
const validateRequest = (schema, source = 'body') => {
    return (req, res, next) => {
        try {
            const data = schema.parse(req[source]);
            req[source] = data;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const response = {
                    success: false,
                    error: 'Validation failed',
                    message: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
                };
                res.status(400).json(response);
                return;
            }
            next(error);
        }
    };
};
exports.validateRequest = validateRequest;
const sanitizeHtml = (input) => {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};
exports.sanitizeHtml = sanitizeHtml;
//# sourceMappingURL=validation.js.map