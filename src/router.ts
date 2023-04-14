import {AppContext} from '@gravity-ui/nodekit';
import {Express} from 'express';
import {AppErrorHandler, AppMiddleware, AppRoutes, AuthPolicy, ExpressFinalError} from './types';

const ALLOWED_METHODS = ['get', 'head', 'options', 'post', 'put', 'patch', 'delete'] as const;
type HttpMethod = (typeof ALLOWED_METHODS)[number];

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

export function setupRoutes(ctx: AppContext, expressApp: Express, routes: AppRoutes) {
    Object.keys(routes).forEach((routeKey) => {
        const rawRoute = routes[routeKey];
        const route = typeof rawRoute === 'function' ? {handler: rawRoute} : rawRoute;
        const controllerName = route.handler.name || 'unnamedController';

        const routeKeyParts = routeKey.split(/\s+/);
        const method: HttpMethod = routeKeyParts[0].toLowerCase() as HttpMethod;
        const routePath = routeKeyParts[1];

        if (!ALLOWED_METHODS.includes(method)) {
            throw new Error(`Unknown http method "${method}" for route "${routePath}"`);
        }

        const handler: AppMiddleware = (req, res, next) => {
            req.ctx = req.originalContext.create(controllerName);
            Promise.resolve(route.handler(req, res))
                .catch(next)
                .finally(() => {
                    req.ctx.end();
                    req.ctx = req.originalContext;
                });
        };
        Object.defineProperty(handler, 'name', {value: controllerName});

        const {
            authPolicy: routeAuthPolicy,
            handler: _h,
            beforeAuth: _beforeAuth,
            afterAuth: _afterAuth,
            ...restRouteInfo
        } = route;
        const authPolicy = routeAuthPolicy || ctx.config.appAuthPolicy || AuthPolicy.disabled;
        const routeInfoMiddleware: AppMiddleware = (req, res, next) => {
            Object.assign(req.routeInfo, restRouteInfo, {authPolicy});

            res.on('finish', () => {
                if (req.ctx.config.appTelemetryChEnableSelfStats) {
                    req.ctx.stats({
                        service: 'self',
                        action: controllerName,
                        responseStatus: res.statusCode,
                        requestId: req.id,
                        requestTime: req.originalContext.getTime(), //We have to use req.originalContext here to get full time
                        requestMethod: req.method,
                        requestUrl: req.originalUrl,
                    });
                }
            });

            next();
        };

        const routeMiddleware: AppMiddleware[] = [
            routeInfoMiddleware,
            ...(ctx.config.appBeforeAuthMiddleware || []),
            ...(route.beforeAuth || []),
        ];

        const authHandler =
            routeAuthPolicy === AuthPolicy.disabled
                ? undefined
                : route.authHandler || ctx.config.appAuthHandler;

        if (authHandler) {
            routeMiddleware.push(authHandler);
        }

        routeMiddleware.push(...(route.afterAuth || []));
        routeMiddleware.push(...(ctx.config.appAfterAuthMiddleware || []));

        const wrappedMiddleware = routeMiddleware.map(wrapMiddleware);

        expressApp[method](routePath, wrappedMiddleware, handler);
    });

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
