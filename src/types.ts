import bodyParser from 'body-parser';
import {ErrorRequestHandler, NextFunction, Request, Response, RequestHandler} from 'express';

declare module '@gravity-ui/nodekit' {
    interface AppConfig {
        expressTrustProxyNumber?: number | boolean;
        expressCookieSecret?: string;
        expressRequestIdHeaderName?: string;

        expressDisableBodyParserJSON?: boolean;
        expressBodyParserJSONConfig?: bodyParser.OptionsJson;

        expressDisableBodyParserURLEncoded?: boolean;
        expressBodyParserURLEncoded?: bodyParser.OptionsUrlencoded;

        expressEnableBodyParserRaw?: boolean;
        expressBodyParserRawConfig?: bodyParser.Options;

        appPort?: number;
        appSocket?: string;

        appFinalErrorHandler?: ErrorRequestHandler;
        appAuthMethod?: RequestHandler;
        appAuthPolicy?: AuthPolicy;

        appBeforeAuth?: RequestHandler[];
        appAfterAuth?: RequestHandler[];
    }
}

export enum AuthPolicy {
    disabled = 'disabled',
    optional = 'optional',
    redirect = 'redirect',
    required = 'required',
}

export interface AppRouteDescription {
    handler: AppRouteHandler;
    authPolicy?: AuthPolicy;
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

export interface AppRouteHandler {
    (
        req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>,
        res: Response<any, Record<string, any>>,
    ): Response<any, Record<string, any>>;
}

export interface AppMiddleware {
    (req: Request, res: Response, next: NextFunction): void | Promise<void>;
}

export interface AppAuthHandler extends AppMiddleware {}

interface ExpressFinalError extends Error {
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
