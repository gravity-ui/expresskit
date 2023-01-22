import {AppContext} from '@gravity-ui/nodekit';
import {Express} from 'express';
import {AppRoutes} from './types';

const ALLOWED_METHODS = ['get', 'head', 'options', 'post', 'put', 'patch', 'delete'];
type HttpMethod = 'get' | 'head' | 'options' | 'post' | 'put' | 'patch' | 'delete';

export function setRoutes(ctx: AppContext, expressApp: Express, routes: AppRoutes) {
    Object.keys(routes).forEach((routeKey) => {
        const rawRoute = routes[routeKey];
        const route = typeof rawRoute === 'function' ? {handler: rawRoute} : rawRoute;

        const routeKeyParts = routeKey.split(/\s+/);
        const method: HttpMethod = routeKeyParts[0].toLowerCase() as HttpMethod;
        const routePath = routeKeyParts[1];

        if (!ALLOWED_METHODS.includes(method)) {
            throw new Error(`Unknown http method "${method}" for route "${routePath}"`);
        }

        ctx.log(`[router] setting ${method} ${routePath}`);

        expressApp[method](routePath, route.handler);
    });
}
