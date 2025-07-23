import {type AppContext, REQUEST_ID_PARAM_NAME} from '@gravity-ui/nodekit';
import {Express, Router} from 'express';
import swaggerUi from 'swagger-ui-express';

import {cspMiddleware, getAppPresets} from './csp/middleware';
import {
    AppErrorHandler,
    AppMiddleware,
    AppMountDescription,
    AppRouteDescription,
    AppRouteHandler,
    AppRoutes,
    AuthPolicy,
    ExpressFinalError,
    HTTP_METHODS,
    HttpMethod,
} from './types';

import {OpenApiRegistry, validationErrorMiddleware} from './validator';

function isAllowedMethod(method: string): method is HttpMethod | 'mount' {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return HTTP_METHODS.includes(method as any) || method === 'mount';
}

function wrapMiddleware(fn: AppMiddleware, i?: number): AppMiddleware {
    const result: AppMiddleware = async (req, res, next) => {
        const reqCtx = req.ctx;
        let ended = false;
        try {
            return await reqCtx.call(`${fn.name || `noname-${i}`} middleware`, async (ctx) => {
                req.ctx = ctx;
                return await fn(req, res, (...args: unknown[]) => {
                    req.ctx = reqCtx;
                    ended = true;
                    next(...args);
                });
            });
        } catch (error) {
            return next(error);
        } finally {
            if (!ended) {
                req.ctx = reqCtx;
            }
        }
    };
    Object.defineProperty(result, 'name', {value: fn.name});

    return result;
}

const UNNAMED_CONTROLLER = 'unnamedController';
function wrapRouteHandler(fn: AppRouteHandler, handlerName?: string) {
    const handlerNameLocal = handlerName || fn.name || UNNAMED_CONTROLLER;

    const handler: AppMiddleware = (req, res, next) => {
        req.ctx = req.originalContext.create(handlerNameLocal);
        if (req.routeInfo.handlerName !== handlerNameLocal) {
            if (req.routeInfo.handlerName === UNNAMED_CONTROLLER) {
                req.routeInfo.handlerName = handlerNameLocal;
            } else {
                req.routeInfo.handlerName = `${req.routeInfo.handlerName}(${handlerNameLocal})`;
            }
        }
        Promise.resolve(fn(req, res))
            .catch(next)
            .finally(() => {
                req.ctx.end();
                req.ctx = req.originalContext;
            });
    };

    Object.defineProperty(handler, 'name', {value: handlerNameLocal});

    return handler;
}

export function setupRoutes(
    ctx: AppContext,
    expressApp: Express,
    routes: AppRoutes,
    openapiRegistry?: OpenApiRegistry,
) {
    const appPresets = getAppPresets(ctx.config.expressCspPresets);

    Object.entries(routes).forEach(([routeKey, rawRoute]) => {
        const routeKeyParts = routeKey.split(/\s+/);
        const method = routeKeyParts[0].toLowerCase();
        const routePath = routeKeyParts[1];

        if (!isAllowedMethod(method)) {
            throw new Error(`Unknown http method "${method}" for route "${routePath}"`);
        }

        const route: AppMountDescription | AppRouteDescription =
            typeof rawRoute === 'function' ? {handler: rawRoute} : rawRoute;

        const {
            authPolicy: routeAuthPolicy,
            handler: routeHandler,
            beforeAuth: _beforeAuth,
            afterAuth: _afterAuth,
            cspPresets,
            ...restRouteInfo
        } = route;
        const authPolicy = routeAuthPolicy || ctx.config.appAuthPolicy || AuthPolicy.disabled;
        const handlerName = restRouteInfo.handlerName || route.handler.name || UNNAMED_CONTROLLER;
        const routeInfoMiddleware: AppMiddleware = function routeInfoMiddleware(req, res, next) {
            Object.assign(req.routeInfo, restRouteInfo, {authPolicy, handlerName});

            res.on('finish', () => {
                if (req.ctx.config.appTelemetryChEnableSelfStats) {
                    req.ctx.stats({
                        service: 'self',
                        action: req.routeInfo.handlerName || UNNAMED_CONTROLLER,
                        responseStatus: res.statusCode,
                        requestId: req.ctx.get(REQUEST_ID_PARAM_NAME) || '',
                        requestTime: req.originalContext.getTime(), //We have to use req.originalContext here to get full time
                        requestMethod: req.method,
                        requestUrl: req.originalUrl,
                        traceId: req.ctx.getTraceId() || '',
                    });
                }
            });

            next();
        };

        const routeMiddleware: AppMiddleware[] = [
            routeInfoMiddleware,
            ...(ctx.config.expressCspEnable
                ? [
                      cspMiddleware({
                          appPresets,
                          routPresets: cspPresets,
                          reportOnly: ctx.config.expressCspReportOnly,
                          reportTo: ctx.config.expressCspReportTo,
                          reportUri: ctx.config.expressCspReportUri,
                      }),
                  ]
                : []),
            ...(ctx.config.appBeforeAuthMiddleware || []),
            ...(route.beforeAuth || []),
        ];

        const authHandler =
            authPolicy === AuthPolicy.disabled
                ? undefined
                : route.authHandler || ctx.config.appAuthHandler;

        if (authHandler) {
            routeMiddleware.push(authHandler);
        }

        routeMiddleware.push(...(route.afterAuth || []));
        routeMiddleware.push(...(ctx.config.appAfterAuthMiddleware || []));

        const wrappedMiddleware = routeMiddleware.map(wrapMiddleware);

        if (method === 'mount') {
            // eslint-disable-next-line new-cap
            const router = Router({mergeParams: true});
            const targetApp = (route as AppMountDescription).handler({router, wrapRouteHandler});
            expressApp.use(routePath, wrappedMiddleware, targetApp || router);
        } else {
            const handler = wrapRouteHandler(routeHandler as AppRouteHandler, handlerName);
            expressApp[method](routePath, wrappedMiddleware, handler);

            if (openapiRegistry) {
                openapiRegistry.registerRoute(
                    method as HttpMethod,
                    routePath,
                    routeHandler as AppRouteHandler,
                    authPolicy === AuthPolicy.disabled ? undefined : authHandler,
                );
            }
        }
    });

    if (ctx.config.openApiRegistry?.enabled && openapiRegistry) {
        const openApiSchema = openapiRegistry.getOpenApiSchema();
        const docsPath = ctx.config.openApiRegistry.path || '/docs';
        expressApp.use(docsPath, swaggerUi.serve, swaggerUi.setup(openApiSchema));
    }

    expressApp.use(validationErrorMiddleware);

    if (ctx.config.appFinalErrorHandler) {
        const appFinalRequestHandler: AppErrorHandler = (error, req, res, next) =>
            Promise.resolve(ctx.config.appFinalErrorHandler?.(error, req, res, next)).catch(next);
        expressApp.use(appFinalRequestHandler);
    }

    const finalRequestHandler: AppErrorHandler = (error: ExpressFinalError, _, res, __) => {
        const errorDescription = 'Unhandled error during request processing';
        ctx.logError(errorDescription, error);
        const statusCode = (error && error.statusCode) || 500;
        res.status(statusCode).send(statusCode === 400 ? 'Bad request' : 'Internal server error');
    };

    expressApp.use(finalRequestHandler);
}
