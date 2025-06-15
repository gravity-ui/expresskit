import { ZodError } from 'zod/v4';

export class ValidationError extends Error {
  public statusCode: number;
  public details: ZodError | unknown;

  constructor(message: string, details?: ZodError | unknown, statusCode: number = 400) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class SerializationError extends Error {
  public statusCode: number;
  public details: ZodError | unknown;

  constructor(message: string, details?: ZodError | unknown, statusCode: number = 500) {
    super(message);
    this.name = 'SerializationError';
    this.statusCode = statusCode;
    this.details = details;
  }
}
