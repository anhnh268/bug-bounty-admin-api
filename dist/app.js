"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
require("express-async-errors");
const config_1 = require("./config/config");
const swagger_1 = require("./config/swagger");
const auth_middleware_1 = require("./middleware/auth.middleware");
const context_middleware_1 = require("./middleware/context.middleware");
const error_middleware_1 = require("./middleware/error.middleware");
const report_controller_1 = require("./controllers/report.controller");
const validation_1 = require("./utils/validation");
const logger_1 = require("./utils/logger");
const report_dto_1 = require("./dtos/report.dto");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)(config_1.config.cors));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger_1.logger.info('Request completed', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
        });
    });
    next();
});
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Bug Bounty Admin API Documentation',
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
    },
}));
app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swagger_1.swaggerSpec);
});
app.get('/health', (_req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: config_1.config.env,
        },
    });
});
const apiRouter = (0, express_1.Router)();
apiRouter.use(auth_middleware_1.authenticate);
apiRouter.use(context_middleware_1.requestContext);
apiRouter.post('/reports', (0, auth_middleware_1.authorize)('admin', 'triager'), (0, validation_1.validateRequest)(report_dto_1.createReportSchema, 'body'), report_controller_1.reportController.createReport);
apiRouter.get('/reports', (0, validation_1.validateRequest)(report_dto_1.listReportsQuerySchema, 'query'), report_controller_1.reportController.getReports);
apiRouter.get('/reports/stats', report_controller_1.reportController.getReportStats);
apiRouter.get('/reports/:id', report_controller_1.reportController.getReportById);
apiRouter.put('/reports/:id/assign', (0, auth_middleware_1.authorize)('admin', 'triager'), (0, validation_1.validateRequest)(report_dto_1.assignReportSchema, 'body'), report_controller_1.reportController.assignReport);
apiRouter.put('/reports/:id/status', (0, auth_middleware_1.authorize)('admin', 'triager'), (0, validation_1.validateRequest)(report_dto_1.updateReportStatusSchema, 'body'), report_controller_1.reportController.updateReportStatus);
app.use('/api/v1', apiRouter);
app.use(error_middleware_1.notFound);
app.use(error_middleware_1.errorHandler);
if (require.main === module) {
    app.listen(config_1.config.port, () => {
        logger_1.logger.info('Server started', {
            port: config_1.config.port,
            environment: config_1.config.env,
        });
    });
}
exports.default = app;
//# sourceMappingURL=app.js.map