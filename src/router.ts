import {type AppContext, REQUEST_ID_PARAM_NAME, USER_ID_PARAM_NAME} from '@gravity-ui/nodekit';
import {Express, Router} from 'express';

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
import {prepareCSRFMiddleware} from './csrf';

import {validationErrorMiddleware} from './validator';

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

export function setupRoutes(ctx: AppContext, expressApp: Express, routes: AppRoutes) {
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
            handlerName: routeHandlerName,
            authPolicy: routeAuthPolicy,
            enableCaching: routeEnableCaching,
            handler: _h,
            beforeAuth: _beforeAuth,
            afterAuth: _afterAuth,
            cspPresets,
            ...restRouteInfo
        } = route;

        const handlerName = routeHandlerName || route.handler.name || UNNAMED_CONTROLLER;
        const authPolicy = routeAuthPolicy || ctx.config.appAuthPolicy || AuthPolicy.disabled;
        const enableCaching =
            typeof routeEnableCaching === 'boolean'
                ? routeEnableCaching
                : Boolean(ctx.config.expressEnableCaching);

        const routeInfoMiddleware: AppMiddleware = function routeInfoMiddleware(req, res, next) {
            Object.assign(req.routeInfo, restRouteInfo, {handlerName, authPolicy, enableCaching});

            res.on('finish', () => {
                if (req.originalContext.config.appTelemetryChEnableSelfStats) {
                    const disableSelfStats = Boolean(req.routeInfo.disableSelfStats);

                    if (!disableSelfStats) {
                        req.originalContext.stats({
                            service: 'self',
                            action: req.routeInfo.handlerName || UNNAMED_CONTROLLER,
                            responseStatus: res.statusCode,
                            // TODO(DakEnviy): Add responseSize
                            requestId: req.originalContext.get(REQUEST_ID_PARAM_NAME) || '',
                            requestTime: req.originalContext.getTime(), // We have to use req.originalContext here to get full time
                            requestMethod: req.method,
                            requestUrl: ctx.utils.redactSensitiveQueryParams(req.originalUrl),
                            traceId: req.originalContext.getTraceId() || '',
                            userId: req.originalContext.get(USER_ID_PARAM_NAME) || '',
                        });
                    }
                }

                setImmediate(() => {
                    req.originalContext.end();
                });
            });

            next();
        };

        const routeMiddleware: AppMiddleware[] = [routeInfoMiddleware];

        if (!enableCaching) {
            const cacheMiddleware: AppMiddleware = (_req, res, next) => {
                res.setHeader('Surrogate-Control', 'no-store');
                res.setHeader(
                    'Cache-Control',
                    'no-store, max-age=0, must-revalidate, proxy-revalidate',
                );
                next();
            };
            routeMiddleware.push(cacheMiddleware);
        }

        if (ctx.config.expressCspEnable) {
            routeMiddleware.push(
                cspMiddleware({
                    appPresets,
                    routPresets: cspPresets,
                    reportOnly: ctx.config.expressCspReportOnly,
                    reportTo: ctx.config.expressCspReportTo,
                    reportUri: ctx.config.expressCspReportUri,
                }),
            );
        }

        routeMiddleware.push(...(ctx.config.appBeforeAuthMiddleware || []));
        routeMiddleware.push(...(route.beforeAuth || []));

        const authHandler =
            authPolicy === AuthPolicy.disabled
                ? undefined
                : route.authHandler || ctx.config.appAuthHandler;

        if (authHandler) {
            routeMiddleware.push(authHandler);

            if (ctx.config.appCsrfSecret) {
                routeMiddleware.push(prepareCSRFMiddleware(ctx, authPolicy as AuthPolicy));
            }
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
            const handler = wrapRouteHandler((route as AppRouteDescription).handler, handlerName);
            expressApp[method](routePath, wrappedMiddleware, handler);
        }
    });

    const errorHandler = ctx.config.appValidationErrorHandler
        ? ctx.config.appValidationErrorHandler(ctx)
        : validationErrorMiddleware;

    expressApp.use(errorHandler);

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
