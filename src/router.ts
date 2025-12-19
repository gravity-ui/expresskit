import {type AppContext, REQUEST_ID_PARAM_NAME, USER_ID_PARAM_NAME} from '@gravity-ui/nodekit';
import {Express, Router} from 'express';

import {cspMiddleware, getAppPresets} from './csp/middleware';
import {
    AppMiddleware,
    AppMountDescription,
    AppRouteDescription,
    AppRouteHandler,
    AppRoutes,
    AuthPolicy,
    HTTP_METHODS,
    HttpMethod,
} from './types';
import {prepareCSRFMiddleware} from './csrf';

// Methods are lowercased to use it in `expressApp[method]`
function isAllowedMethod(method: string): method is Lowercase<HttpMethod> | 'mount' {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return HTTP_METHODS.includes(method.toUpperCase() as any) || method === 'mount';
}

function wrapMiddleware(fn: AppMiddleware, i?: number): AppMiddleware {
    const result: AppMiddleware = async (req, res, next) => {
        const reqCtx = req.ctx;
        const ctx = reqCtx.create(`${fn.name || `noname-${i}`} middleware`);

        let ended = false;
        req.ctx = ctx;

        try {
            await fn(req, res, (...args: unknown[]) => {
                ctx.end();
                req.ctx = reqCtx;
                ended = true;
                next(...args);
            });
        } catch (error) {
            if (!ended) {
                ctx.fail(error);
                req.ctx = reqCtx;
                next(error);
                return;
            }
        }
    };
    Object.defineProperty(result, 'name', {value: fn.name});

    return result;
}

const UNNAMED_CONTROLLER = 'unnamedController';
function wrapRouteHandler(fn: AppRouteHandler, handlerName?: string) {
    const handlerNameLocal = handlerName || fn.name || UNNAMED_CONTROLLER;

    const handler: AppMiddleware = async (req, res, next) => {
        req.ctx = req.originalContext.create(handlerNameLocal);
        if (req.routeInfo.handlerName !== handlerNameLocal) {
            if (req.routeInfo.handlerName === UNNAMED_CONTROLLER) {
                req.routeInfo.handlerName = handlerNameLocal;
            } else {
                req.routeInfo.handlerName = `${req.routeInfo.handlerName}(${handlerNameLocal})`;
            }
        }
        try {
            await fn(req, res);
            req.ctx.end();
            req.ctx = req.originalContext;
        } catch (error) {
            req.ctx.fail(error);
            req.ctx = req.originalContext;
            next(error);
            return;
        }
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
            throw new Error(
                `Unknown http method "${method.toUpperCase()}" for route "${routePath}"`,
            );
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
        const authPolicy = routeAuthPolicy || ctx.config.appAuthPolicy || `${AuthPolicy.disabled}`;
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
                    routePresets: cspPresets,
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
                routeMiddleware.push(prepareCSRFMiddleware(ctx, authPolicy));
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
}
