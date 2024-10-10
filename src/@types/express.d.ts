import type {AppContext} from '@gravity-ui/nodekit';
import type {AppRouteParams} from '../';

declare global {
    namespace Express {
        export interface Request {
            id: string;
            ctx: AppContext;
            originalContext: AppContext;
            routeInfo: AppRouteParams;
        }
    }
}

declare module 'express' {
    export interface Request {
        id: string;
        ctx: AppContext;
        originalContext: AppContext;
        routeInfo: AppRouteParams;
    }
}
