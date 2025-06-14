import {Request as ExpressRequest, Response} from 'express';
import {z} from 'zod/v4';

// Type to check if a response schema is provided in config
export type HasResponseSchema<T> = T extends { response: z.ZodType<any> } ? true : false;

// Utility type to ensure TProvided is exactly TExpected.
export type Exact<TExpected, TProvided extends TExpected> =
    Exclude<keyof TProvided, keyof TExpected> extends never
        ? TProvided
        : TExpected & {
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

// Base interface with common Response methods
export interface BaseApiResponse extends Response {
    // No serialization methods here
}

// Conditionally add serialization methods based on whether schema exists
export type ApiResponse<TResponse = unknown, HasSchema extends boolean = true> = 
    BaseApiResponse & 
    (HasSchema extends true 
        ? { 
            // Both methods available only when schema exists
            typedJson: <D extends TResponse>(data: Exact<TResponse, D>) => void;
            serialize: <D extends TResponse>(data: D) => void;
        } 
        : {
            // Neither method available when schema doesn't exist
            typedJson?: never;
            serialize?: never;
        }
    );

// Type for API route configuration
export interface ApiRouteConfig {
    name?: string;
    tags?: string[];
    manualValidation?: boolean; // If true, request validation must be called manually
    request?: {
        body?: z.ZodType<any>;
        params?: z.ZodType<any>;
        query?: z.ZodType<any>;
        headers?: z.ZodType<any>;
    };
    response?: z.ZodType<any>;
}

// Infer types from Zod schemas
export type InferZodType<T extends z.ZodType<any> | undefined> =
    T extends z.ZodType<any> ? z.infer<T> : unknown;

// Generic type parameters for withApi function
export type WithApiTypeParams<
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
> = {
    IsManualActual: TConfig['manualValidation'] extends true ? true : false;
    HasResponseSchema: TConfig['response'] extends z.ZodType<any> ? true : false;
    TBody: TBody;
    TParams: TParams;
    TQuery: TQuery;
    THeaders: THeaders;
    TResponse: TResponse;
};

// Helper type for getting the manual validation status
export type IsManualValidation<TConfig extends ApiRouteConfig> = 
    TConfig['manualValidation'] extends true ? true : false;

// Helper type for checking if response schema exists
export type HasResponseSchemaType<TConfig extends ApiRouteConfig> = 
    TConfig['response'] extends z.ZodType<any> ? true : false;
