import {ZodError} from 'zod';

export class ValidationError extends Error {
    statusCode: number;
    zodError?: ZodError;

    constructor(message: string, zodError?: ZodError, statusCode = 400) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = statusCode;
        this.zodError = zodError;
    }
}

export class ResponseValidationError extends Error {
    statusCode: number;
    zodError?: ZodError;

    constructor(message: string, zodError?: ZodError, statusCode = 500) {
        super(message);
        this.name = 'ResponseValidationError';
        this.statusCode = statusCode;
        this.zodError = zodError;
    }
}
