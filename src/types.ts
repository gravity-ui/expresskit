import type {AppContext} from '@gravity-ui/nodekit';
import type bodyParser from 'body-parser';
import type {
    ErrorRequestHandler,
    NextFunction,
    Request,
    Response,
    RequestHandler,
    Router,
} from 'express';

declare global {
    // eslint-disable-next-line
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

declare module '@gravity-ui/nodekit' {
    interface AppConfig {
        expressTrustProxyNumber?: number | boolean;
        expressCookieSecret?: string;
        expressRequestIdHeaderName?: string;

        expressDisableBodyParserJSON?: boolean;
        expressBodyParserJSONConfig?: bodyParser.OptionsJson;

        expressDisableBodyParserURLEncoded?: boolean;
        expressBodyParserURLEncodedConfig?: bodyParser.OptionsUrlencoded;

        expressBodyParserRawConfig?: bodyParser.Options;

        appPort?: number;
        appSocket?: string;

        appFinalErrorHandler?: ErrorRequestHandler;
        appAuthHandler?: RequestHandler;
        appAuthPolicy?: `${AuthPolicy}`;

        appBeforeAuthMiddleware?: RequestHandler[];
        appAfterAuthMiddleware?: RequestHandler[];

        appTelemetryChEnableSelfStats?: boolean;
    }

    interface AppContextParams {
        requestId: string;
    }
}

export enum AuthPolicy {
    disabled = 'disabled',
    optional = 'optional',
    redirect = 'redirect',
    required = 'required',
}

export interface AppRouteParams {
    authPolicy?: `${AuthPolicy}`;
    handlerName?: string;
}

export interface AppRouteDescription extends AppRouteParams {
    handler: AppRouteHandler;
    authHandler?: AppAuthHandler;
    beforeAuth?: AppMiddleware[];
    afterAuth?: AppMiddleware[];
}

export const HTTP_METHODS = ['get', 'head', 'options', 'post', 'put', 'patch', 'delete'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface AppMountHandler {
    (args: {
        router: Router;
        wrapRouteHandler: (fn: AppRouteHandler, handlerName?: string) => AppMiddleware;
    }): void | Router;
}

export interface AppMountDescription extends Omit<AppRouteDescription, 'handler'> {
    handler: AppMountHandler;
}

export interface AppRoutes {
    [methodAndPath: `${Uppercase<HttpMethod>} ${string}`]: AppRouteHandler | AppRouteDescription;
    [mountPath: `MOUNT ${string}`]: AppMountHandler | AppMountDescription;
}

interface ParamsDictionary {
    [key: string]: string;
}
interface ParsedQs {
    [key: string]: undefined | string | string[] | ParsedQs | ParsedQs[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AppRouteHandler {
    (
        req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>,
        res: Response<any, Record<string, any>>,
    ): void | Promise<void>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface AppMiddleware {
    (req: Request, res: Response, next: NextFunction): void | Promise<void>;
}

export interface AppAuthHandler extends AppMiddleware {}

export interface ExpressFinalError extends Error {
    statusCode?: number;
}

export interface AppErrorHandler {
    (
        error: ExpressFinalError,
        req: Request,
        res: Response,
        next: NextFunction,
    ): void | Promise<void>;
}

export {Request, Response, NextFunction};
