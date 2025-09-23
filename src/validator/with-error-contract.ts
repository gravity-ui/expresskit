import {Request as ExpressRequest, Response} from 'express';
import {AppErrorHandler} from '../types';
import {ErrorContract, ErrorResponse, Exact, InferDataFromErrorDef} from './types';
import {registerErrorContract} from './contract-registry';

export function withErrorContract<TConfig extends ErrorContract>(config: TConfig) {
    return function (
        handler: (
            err: Error,
            req: ExpressRequest,
            res: ErrorResponse<TConfig>,
            next: (err?: Error) => void,
        ) => Promise<void> | void,
    ) {
        const finalHandler: AppErrorHandler = (
            err: Error,
            req: ExpressRequest,
            expressRes: Response,
            next: (err?: Error) => void,
        ) => {
            const enhancedRes = expressRes as ErrorResponse<TConfig>;

            const typedRes = enhancedRes as ErrorResponse<TConfig>;

            typedRes.sendError = function <
                S extends keyof TConfig['errors']['content'],
                D extends InferDataFromErrorDef<TConfig['errors']['content'][S]>,
            >(
                statusCode: S,
                data?: Exact<InferDataFromErrorDef<TConfig['errors']['content'][S]>, D>,
            ): void {
                expressRes.status(statusCode as number);
                expressRes.json(data);
            };

            return handler(err, req, enhancedRes, next);
        };

        registerErrorContract(finalHandler, config);

        return finalHandler;
    };
}
