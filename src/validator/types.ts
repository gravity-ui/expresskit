import {Request as ExpressRequest, Response} from 'express';
import {z} from 'zod/v4';

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

export interface BaseApiResponse extends Response {
    // No serialization methods here
}

// Helper to extract the actual Zod schema from a response definition in ApiRouteConfig.responses
export type ExtractSchemaFromResponseDef<TDef> = TDef extends { schema: infer S } // Simplified: TDef is always an object with a schema
    ? S extends z.ZodType<any> ? S : never
    : never;

// Helper to infer data type from a response definition - EXPORT THIS
export type InferDataFromResponseDef<TDef> = z.infer<ExtractSchemaFromResponseDef<TDef>>;

// Interface for the response methods that will be typed based on ApiRouteConfig['responses']
interface TypedResponseMethods<TResponses extends Record<number, any>> { // Status code key is number
    typedJson: <
        S extends keyof TResponses, // S is the status code (number)
        // D is the actual data type being passed, constrained by the schema for status code S
        D extends InferDataFromResponseDef<TResponses[S]>
    >(
        statusCode: S,
        data: Exact<InferDataFromResponseDef<TResponses[S]>, D>
    ) => void;

    serialize: <S extends keyof TResponses>(
        statusCode: S, // S is the status code (number)
        data: InferDataFromResponseDef<TResponses[S]> // Exact not always needed for serialize, but good for consistency
    ) => void;
}

export interface ApiRouteConfig {
    name?: string; 
    operationId?: string; 
    summary?: string; 
    description?: string; 
    tags?: string[];
    manualValidation?: boolean; 
    request?: {
        body?: z.ZodType<any>;
        params?: z.ZodType<any>;
        query?: z.ZodType<any>;
        headers?: z.ZodType<any>;
    };
    responses: Record<
        number, 
        { schema: z.ZodType<any>; description?: string }
    >;
}

export type InferZodType<T extends z.ZodType<any> | undefined> =
    T extends z.ZodType<any> ? z.infer<T> : unknown;

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
    TBody = InferZodType<TBodySchema>,
    TParams = InferZodType<TParamsSchema>,
    TQuery = InferZodType<TQuerySchema>,
    THeaders = InferZodType<THeadersSchema>,
> = {
    IsManualActual: TConfig['manualValidation'] extends true ? true : false;
    TBody: TBody;
    TParams: TParams;
    TQuery: TQuery;
    THeaders: THeaders;
};

// Helper type for getting the manual validation status
export type IsManualValidation<TConfig extends ApiRouteConfig> = 
    TConfig['manualValidation'] extends true ? true : false;

export type ApiHandler<
    TConfig extends ApiRouteConfig,
    P extends WithApiTypeParams<TConfig> = WithApiTypeParams<TConfig>,
> = (
    req: ApiRequest<P['IsManualActual'], P['TBody'], P['TParams'], P['TQuery'], P['THeaders'] >,
    res: ApiResponse<TConfig>,
    next: (err?: any) => void,
) => void | Promise<void>;

export type ApiResponse<TConfig extends ApiRouteConfig> = BaseApiResponse &
    TypedResponseMethods<TConfig['responses']>;
