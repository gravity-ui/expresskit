import {AppError} from '@gravity-ui/nodekit';
import {ZodError} from 'zod';

export class ValidationError extends AppError {
    zodError?: ZodError;

    constructor(message: string, zodError?: ZodError) {
        super(message, {name: 'ValidationError'});
        this.zodError = zodError;
    }
}

export class ResponseValidationError extends AppError {
    zodError?: ZodError;

    constructor(message: string, zodError?: ZodError) {
        super(message, {name: 'ResponseValidationError'});
        this.zodError = zodError;
    }
}
