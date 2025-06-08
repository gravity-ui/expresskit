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
