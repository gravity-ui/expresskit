import {ResponseValidationError, ValidationError} from './errors';
import {z} from 'zod';
import {ErrorContract} from './types';
import {withErrorContract} from './with-error-contract';

export const ValidationErrorSchema = z.object({
    error: z.string(),
    code: z.literal('VALIDATION_FAILED'),
    issues: z
        .array(
            z.object({
                path: z.array(z.any()),
                message: z.string(),
                code: z.string(),
            }),
        )
        .optional(),
});

export const ResponseValidationErrorSchema = z.object({
    error: z.string(),
    code: z.literal('RESPONSE_VALIDATION_FAILED'),
});

export const ValidationErrorContract = {
    errors: {
        content: {
            400: {
                name: 'ValidationError',
                schema: ValidationErrorSchema,
                description: 'Validation error',
            },
            500: {
                name: 'ResponseValidationError',
                schema: ResponseValidationErrorSchema,
                description: 'Response validation error',
            },
        },
    },
} satisfies ErrorContract;

export const validationErrorMiddleware = withErrorContract(ValidationErrorContract)((
    err,
    _req,
    res,
    next,
) => {
    if (err instanceof ValidationError) {
        if (!res.headersSent) {
            const zodError = err.zodError as z.ZodError | undefined;
            res.sendError(400, {
                error: err.message || 'Validation error',
                code: 'VALIDATION_FAILED',
                issues: zodError?.issues.map((issue: z.ZodIssue) => ({
                    path: issue.path,
                    message: issue.message,
                    code: issue.code,
                })),
            });
        }
    } else if (err instanceof ResponseValidationError) {
        if (!res.headersSent) {
            res.sendError(500, {
                error: err.message || 'Internal Server Error',
                code: 'RESPONSE_VALIDATION_FAILED',
            });
        }
    } else {
        next(err);
        return;
    }
});
