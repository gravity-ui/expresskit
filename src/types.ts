import {AppContext} from '@gravity-ui/nodekit';
import bodyParser from 'body-parser';
import {ErrorRequestHandler, NextFunction, Request, Response, RequestHandler} from 'express';

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
        appAuthPolicy?: AuthPolicy;

        appBeforeAuthMiddleware?: RequestHandler[];
        appAfterAuthMiddleware?: RequestHandler[];
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
    authPolicy?: AuthPolicy;
}

export interface AppRouteDescription extends AppRouteParams {
    handler: AppRouteHandler;
    authHandler?: AppAuthHandler;
    beforeAuth?: AppMiddleware[];
    afterAuth?: AppMiddleware[];
}

export interface AppRoutes {
    [methodAndPath: string]: AppRouteHandler | AppRouteDescription;
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

export {Request, Response};
