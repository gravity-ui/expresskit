import {ZodError} from 'zod/v4';

export class ValidationError extends Error {
    statusCode: number;
    details: ZodError | unknown;

    constructor(message: string, details?: ZodError | unknown, statusCode = 400) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = statusCode;
        this.details = details;
    }
}

export class ResponseValidationError extends Error {
    statusCode: number;
    details: ZodError | unknown;

    constructor(message: string, details?: ZodError | unknown, statusCode = 500) {
        super(message);
        this.name = 'ResponseValidationError';
        this.statusCode = statusCode;
        this.details = details;
    }
}
