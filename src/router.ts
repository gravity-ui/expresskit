import {AppContext} from '@gravity-ui/nodekit';
import {Express} from 'express';
import {AppErrorHandler, AppMiddleware, AppRoutes, ExpressFinalError} from './types';

const ALLOWED_METHODS = ['get', 'head', 'options', 'post', 'put', 'patch', 'delete'];
type HttpMethod = 'get' | 'head' | 'options' | 'post' | 'put' | 'patch' | 'delete';

export function setupRoutes(ctx: AppContext, expressApp: Express, routes: AppRoutes) {
    Object.keys(routes).forEach((routeKey) => {
        const rawRoute = routes[routeKey];
        const route = typeof rawRoute === 'function' ? {handler: rawRoute} : rawRoute;

        const routeMiddleware: AppMiddleware[] = [];
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

        expressApp[method](routePath, routeMiddleware, handler);
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
