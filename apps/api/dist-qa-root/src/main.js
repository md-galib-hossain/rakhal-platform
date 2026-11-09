"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const env_1 = require("src/core/config/env");
const env_2 = require("src/core/config/env");
const helmet_1 = __importDefault(require("helmet"));
const logger_service_1 = require("src/core/logger/logger/logger.service");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const sentry_service_1 = require("src/core/observability/sentry/sentry.service");
const swagger_1 = require("@nestjs/swagger");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        bufferLogs: true,
    });
    const logger = await app.resolve(logger_service_1.LoggerService);
    const sentry = await app.resolve(sentry_service_1.SentryService);
    app.useLogger(logger);
    sentry.initialize(app.get(env_2.sentryConfig.KEY));
    app.use((0, helmet_1.default)());
    app.use((0, cookie_parser_1.default)());
    const { apiPrefix, name, appVersion, swaggerEnabled, trustProxyHops, isProduction, allowedOrigins, } = app.get(env_1.appConfig.KEY);
    if (isProduction && allowedOrigins.length === 0) {
        throw new Error('ALLOWED_ORIGINS must be set in production (comma-separated origin list) — refusing to boot with CORS open to any origin.');
    }
    app.enableCors({
        origin: isProduction ? allowedOrigins : true,
        credentials: true,
    });
    if (trustProxyHops > 0) {
        app.set('trust proxy', trustProxyHops);
        logger.log(`Trusting ${trustProxyHops} reverse-proxy hop(s) for client IP`);
    }
    app.setGlobalPrefix(apiPrefix, {
        exclude: [
            { path: 'health', method: common_1.RequestMethod.GET },
            { path: 'ready', method: common_1.RequestMethod.GET },
            { path: 'live', method: common_1.RequestMethod.GET },
            { path: 'metrics', method: common_1.RequestMethod.GET },
        ],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    if (swaggerEnabled) {
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle(`${name} API`)
            .setDescription('API documentation for the Rakhal dairy-farm operations backend')
            .setVersion(appVersion)
            .addBearerAuth()
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
        logger.warn('Swagger docs enabled at /api/docs (non-production only)');
    }
    const { port } = app.get(env_1.appConfig.KEY);
    await app.listen(port);
}
void bootstrap();
//# sourceMappingURL=main.js.map