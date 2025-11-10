import {AppContext} from '@gravity-ui/nodekit';
import {Express} from 'express';

import {AppErrorHandler} from './types';
import {validationErrorMiddleware} from './validator';

export function setupErrorHandlers(ctx: AppContext, expressApp: Express) {
    const validationErrorHandler = ctx.config.appValidationErrorHandler
        ? ctx.config.appValidationErrorHandler(ctx)
        : validationErrorMiddleware;
    const validationRequestHandler: AppErrorHandler = async (error, req, res, next) => {
        try {
            await validationErrorHandler(error, req, res, next);
        } catch (err) {
            next(err);
            return;
        }
    };
    expressApp.use(validationRequestHandler);

    const appFinalErrorHandler = ctx.config.appFinalErrorHandler;
    if (appFinalErrorHandler) {
        const appFinalRequestHandler: AppErrorHandler = async (error, req, res, next) => {
            try {
                await appFinalErrorHandler(error, req, res, next);
            } catch (err) {
                next(err);
                return;
            }
        };
        expressApp.use(appFinalRequestHandler);
    }

    const finalRequestHandler: AppErrorHandler = (error, _req, res, _next) => {
        const errorDescription = 'Unhandled error during request processing';
        ctx.logError(errorDescription, error);
        const statusCode = (error && error.statusCode) || 500;
        res.status(statusCode).send(statusCode === 400 ? 'Bad request' : 'Internal server error');
    };
    expressApp.use(finalRequestHandler);
}
