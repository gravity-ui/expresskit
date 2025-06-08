import {Request, Response} from 'express';
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
    TBody = unknown,
    TParams = unknown,
    TQuery = unknown,
    THeaders = unknown,
> extends Request {
    validateBody: () => Promise<TBody>;
    validateParams: () => Promise<TParams>;
    validateQuery: () => Promise<TQuery>;
    validateHeaders: () => Promise<THeaders>;
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
    return function (
        handler: (
            req: ApiRequest<TBody, TParams, TQuery, THeaders>,
            res: ApiResponse<TResponse>,
        ) => Promise<void> | void,
    ) {
        return async (req: Request, res: Response) => {
            const enhancedReq = req as ApiRequest<TBody, TParams, TQuery, THeaders>;

            enhancedReq.validateBody = async () => {
                if (!config.request?.body) {
                    return {} as TBody;
                }

                const result = await config.request.body.safeParseAsync(req.body);
                if (!result.success) {
                    throw new ValidationError('Invalid request body', result.error);
                }

                return result.data as TBody;
            };

            enhancedReq.validateParams = async () => {
                if (!config.request?.params) {
                    return {} as TParams;
                }

                const result = await config.request.params.safeParseAsync(req.params);
                if (!result.success) {
                    throw new ValidationError('Invalid request parameters', result.error);
                }

                return result.data as TParams;
            };

            enhancedReq.validateQuery = async () => {
                if (!config.request?.query) {
                    return {} as TQuery;
                }

                const result = await config.request.query.safeParseAsync(req.query);
                if (!result.success) {
                    throw new ValidationError('Invalid query parameters', result.error);
                }

                return result.data as TQuery;
            };

            enhancedReq.validateHeaders = async () => {
                if (!config.request?.headers) {
                    return {} as THeaders;
                }

                const result = await config.request.headers.safeParseAsync(req.headers);
                if (!result.success) {
                    throw new ValidationError('Invalid request headers', result.error);
                }

                return result.data as THeaders;
            };

            const enhancedRes = res as ApiResponse<TResponse>;

            enhancedRes.serialized = function <D extends TResponse>(
                status: number,
                data: Exact<TResponse, D>,
            ): void {
                (res as Response).status(status).json(data);
            };

            await handler(enhancedReq, enhancedRes);
        };
    };
}
