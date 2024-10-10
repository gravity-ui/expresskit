import type {NextFunction, Request, Response, Router} from 'express';

import type {CSPPreset} from './csp';
import type {getDefaultPresets} from './csp/default-presets';

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
    cspPresets?:
        | CSPPreset
        | ((params: {
              getDefaultPresets: typeof getDefaultPresets;
              appPresets: CSPPreset;
          }) => CSPPreset);
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
