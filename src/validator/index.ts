import {Request as ExpressRequest, Response} from 'express';
import {z} from 'zod/v4';
import {ValidationError} from './errors';

export {ValidationError} from './errors';

// Utility type to ensure TProvided is exactly TExpected.
// It leverages the `TProvided extends TExpected` constraint from the call site (e.g., in a generic function).
// If TProvided has keys not in TExpected, those keys are mapped to a specific error string literal type.
type Exact<TExpected, TProvided extends TExpected> =
    // Check if there are any keys in TProvided that are not in TExpected
    Exclude<keyof TProvided, keyof TExpected> extends never
        ? TProvided // No extra keys, and TProvided is assignable to TExpected (due to constraint). All good.
        : // There are extra keys. Construct a type that demands these extra keys conform to an error message type.
          TExpected & {
              // Intersect with TExpected to ensure base compatibility
              [K in Exclude<
                  keyof TProvided,
                  keyof TExpected
              >]: `Error: Unexpected property '${Extract<K, string>}'`;
          };

// Type definitions for API Request and Response
export interface ApiRequest<
    IsManual extends boolean,
    TBody = unknown,
    TParams = unknown,
    TQuery = unknown,
    THeaders = unknown,
> extends Omit<ExpressRequest, 'body' | 'params' | 'query' | 'headers'> { 
    body: IsManual extends true ? ExpressRequest['body'] : TBody;
    params: IsManual extends true ? ExpressRequest['params'] : TParams;
    query: IsManual extends true ? ExpressRequest['query'] : TQuery;
    headers: IsManual extends true ? ExpressRequest['headers'] : THeaders;

    validate: () => Promise<{
        body: TBody;
        params: TParams;
        query: TQuery;
        headers: THeaders;
    }>;
}

export interface ApiResponse<TResponse = unknown> extends Response {
    serialized: {
        <D extends TResponse>(status: number, data: Exact<TResponse, D>): void;
    };
}

// Type for API route configuration
export interface ApiRouteConfig {
    name?: string;
    tags?: string[];
    manual?: boolean;
    request?: {
        body?: z.ZodType<any>;
        params?: z.ZodType<any>;
        query?: z.ZodType<any>;
        headers?: z.ZodType<any>;
    };
    response?: z.ZodType<any>;
}

// Infer types from Zod schemas
type InferZodType<T extends z.ZodType<any> | undefined> =
    T extends z.ZodType<any> ? z.infer<T> : unknown;

// withApi function definition
export function withApi<
    TConfig extends ApiRouteConfig,
    TBodySchema extends z.ZodType<any> = TConfig['request'] extends {body: infer U}
        ? U extends z.ZodType<any>
            ? U
            : z.ZodType<unknown>
        : z.ZodType<unknown>,
    TParamsSchema extends z.ZodType<any> = TConfig['request'] extends {params: infer U}
        ? U extends z.ZodType<any>
            ? U
            : z.ZodType<unknown>
        : z.ZodType<unknown>,
    TQuerySchema extends z.ZodType<any> = TConfig['request'] extends {query: infer U}
        ? U extends z.ZodType<any>
            ? U
            : z.ZodType<unknown>
        : z.ZodType<unknown>,
    THeadersSchema extends z.ZodType<any> = TConfig['request'] extends {headers: infer U}
        ? U extends z.ZodType<any>
            ? U
            : z.ZodType<unknown>
        : z.ZodType<unknown>,
    TResponseSchema extends z.ZodType<any> = TConfig['response'] extends z.ZodType<any>
        ? TConfig['response']
        : z.ZodType<unknown>,
    TBody = InferZodType<TBodySchema>,
    TParams = InferZodType<TParamsSchema>,
    TQuery = InferZodType<TQuerySchema>,
    THeaders = InferZodType<THeadersSchema>,
    TResponse = InferZodType<TResponseSchema>,
>(config: TConfig) {
    type IsManualActual = TConfig['manual'] extends true ? true : false;

    return function (
        handler: (
            req: ApiRequest<IsManualActual, TBody, TParams, TQuery, THeaders>,
            res: ApiResponse<TResponse>,
        ) => Promise<void> | void,
    ) {
        return async (expressReq: ExpressRequest, expressRes: Response) => {
            const enhancedReq = expressReq as ApiRequest<IsManualActual, TBody, TParams, TQuery, THeaders>;

            enhancedReq.validate = async () => {
                const shape: Record<string, z.ZodType<any>> = {};
                const dataToValidate: Record<string, any> = {};

                if (config.request?.body) {
                    shape.body = config.request.body;
                    dataToValidate.body = expressReq.body;
                }
                if (config.request?.params) {
                    shape.params = config.request.params;
                    dataToValidate.params = expressReq.params;
                }
                if (config.request?.query) {
                    shape.query = config.request.query;
                    dataToValidate.query = expressReq.query;
                }
                if (config.request?.headers) {
                    shape.headers = config.request.headers;
                    dataToValidate.headers = expressReq.headers;
                }

                // If no schemas are defined, return empty objects for all parts
                if (Object.keys(shape).length === 0) {
                    return {
                        body: {} as TBody,
                        params: {} as TParams,
                        query: {} as TQuery,
                        headers: {} as THeaders,
                    };
                }

                const combinedSchema = z.object(shape);
                const result = await combinedSchema.safeParseAsync(dataToValidate);

                if (!result.success) {
                    // result.error will contain aggregated errors from all parts
                    throw new ValidationError('Invalid request data', result.error);
                }

                // Initialize with defaults, then override with validated data if present
                // The type of result.data will be an object with keys corresponding to the shape
                const validatedData = result.data as { body?: TBody, params?: TParams, query?: TQuery, headers?: THeaders };

                let body: TBody = {} as TBody;
                let params: TParams = {} as TParams;
                let query: TQuery = {} as TQuery;
                let headers: THeaders = {} as THeaders;

                if (validatedData.body !== undefined) {
                    body = validatedData.body;
                }
                if (validatedData.params !== undefined) {
                    params = validatedData.params;
                }
                if (validatedData.query !== undefined) {
                    query = validatedData.query;
                }
                if (validatedData.headers !== undefined) {
                    headers = validatedData.headers;
                }

                return {
                    body,
                    params,
                    query,
                    headers,
                };
            };

            // Automatically validate request parts unless manual validation is specified
            if (config.manual !== true) {
                try {
                    const validatedData = await enhancedReq.validate();
                    // Assign validated data using type assertions to satisfy the conditional types
                    (enhancedReq as { body: TBody }).body = validatedData.body;
                    (enhancedReq as { params: TParams }).params = validatedData.params;
                    (enhancedReq as { query: TQuery }).query = validatedData.query;
                    (enhancedReq as { headers: THeaders }).headers = validatedData.headers;
                } catch (error) {
                    if (error instanceof ValidationError) {
                        expressRes.status(error.statusCode).json({
                            error: error.message,
                            details: error.details
                        });
                        return; 
                    }
                    throw error;
                }
            }
            // If manual mode (IsManualActual is true), or no schema for a part,
            // the respective part on enhancedReq remains from expressReq.
            // This aligns with the conditional types for enhancedReq properties.

            const enhancedRes = expressRes as ApiResponse<TResponse>;

            enhancedRes.serialized = function <D extends TResponse>(
                status: number,
                data: Exact<TResponse, D>,
            ): void {
                (expressRes as Response).status(status).json(data); // Changed res to expressRes
            };

            await handler(enhancedReq, enhancedRes);
        };
    };
}
