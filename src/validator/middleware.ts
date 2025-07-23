import {NextFunction, Request, Response} from 'express';
import {ResponseValidationError, ValidationError} from './errors';
import {z} from 'zod/v4';

export function validationErrorMiddleware(
    err: unknown,
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    if (err instanceof ValidationError) {
        if (!res.headersSent) {
            const zodError = err.details as z.ZodError | undefined;
            res.status(err.statusCode || 400).json({
                error: err.message || 'Validation error',
                code: 'VALIDATION_ERROR',
                issues: zodError?.issues.map((issue: z.ZodIssue) => ({
                    path: issue.path,
                    message: issue.message,
                    code: issue.code,
                })),
            });
        }
    } else if (err instanceof ResponseValidationError) {
        if (!res.headersSent) {
            res.status(err.statusCode || 500).json({
                error: 'Internal Server Error',
                code: 'RESPONSE_VALIDATION_FAILED',
            });
        }
    } else {
        next(err);
        return;
    }
}
