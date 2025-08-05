"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const config_1 = require("../config/config");
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        const response = {
            success: false,
            error: 'Unauthorized',
            message: 'No authentication token provided',
        };
        res.status(401).json(response);
        return;
    }
    if (token !== config_1.config.apiToken) {
        const response = {
            success: false,
            error: 'Unauthorized',
            message: 'Invalid authentication token',
        };
        res.status(401).json(response);
        return;
    }
    req.user = {
        id: 'admin-user-id',
        email: 'admin@bugbounty.com',
        role: 'admin',
    };
    next();
};
exports.authenticate = authenticate;
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            const response = {
                success: false,
                error: 'Unauthorized',
                message: 'User not authenticated',
            };
            res.status(401).json(response);
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            const response = {
                success: false,
                error: 'Forbidden',
                message: 'Insufficient permissions',
            };
            res.status(403).json(response);
            return;
        }
        next();
    };
};
exports.authorize = authorize;
//# sourceMappingURL=auth.middleware.js.map