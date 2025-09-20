import {ZodError} from 'zod';

export class ValidationError extends Error {
    zodError?: ZodError;

    constructor(message: string, zodError?: ZodError) {
        super(message);
        this.name = 'ValidationError';
        this.zodError = zodError;
    }
}

export class ResponseValidationError extends Error {
    zodError?: ZodError;

    constructor(message: string, zodError?: ZodError) {
        super(message);
        this.name = 'ResponseValidationError';
        this.zodError = zodError;
    }
}
