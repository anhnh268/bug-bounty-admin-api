"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContext = void 0;
const uuid_1 = require("uuid");
const requestContext = (req, _res, next) => {
    const context = {
        user: req.user,
        requestId: (0, uuid_1.v4)(),
        timestamp: new Date(),
        ip: req.ip || req.socket.remoteAddress,
    };
    req.context = context;
    next();
};
exports.requestContext = requestContext;
//# sourceMappingURL=context.middleware.js.map