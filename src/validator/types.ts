import {Request as ExpressRequest, Response} from 'express';
import {z} from 'zod';

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

export interface ContractRequest<
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

export interface BaseContractResponse extends Response {
    // No serialization methods here
}

// Helper to extract the actual Zod schema from a response definition in ApiRouteConfig.response.content
export type ExtractSchemaFromResponseDef<TDef> = TDef extends {schema?: infer S}
    ? S extends z.ZodType
        ? S
        : never
    : never;

// Helper to infer data type from a response definition - EXPORT THIS
export type InferDataFromResponseDef<TDef> =
    ExtractSchemaFromResponseDef<TDef> extends never
        ? undefined
        : z.infer<ExtractSchemaFromResponseDef<TDef>>;

// Interface for the response methods that will be typed based on ApiRouteConfig['response']['content']
interface TypedResponseMethods<TContent extends Record<number, {schema?: z.ZodType}>> {
    // Status code key is number
    sendTyped: <
        S extends keyof TContent, // S is the status code (number)
        // D is the actual data type being passed, constrained by the schema for status code S
        D extends InferDataFromResponseDef<TContent[S]> = InferDataFromResponseDef<TContent[S]>,
    >(
        statusCode: S,
        data?: ExtractSchemaFromResponseDef<TContent[S]> extends never
            ? undefined
            : Exact<InferDataFromResponseDef<TContent[S]>, D>,
    ) => void;

    sendValidated: <S extends keyof TContent>(
        statusCode: S, // S is the status code (number)
        data?: ExtractSchemaFromResponseDef<TContent[S]> extends never
            ? undefined
            : InferDataFromResponseDef<TContent[S]>, // Exact not always needed for serialize, but good for consistency
    ) => void;
}

export interface RouteContract {
    name?: string;
    operationId?: string;
    summary?: string;
    description?: string;
    tags?: string[];
    request?: {
        body?: z.ZodType;
        params?: z.ZodType;
        query?: z.ZodType;
        headers?: z.ZodType;
        contentType?: string[];
    };
    response: {
        contentType?: string;
        content: Record<number, {schema?: z.ZodType; description?: string}>;
    };
}

export interface WithContractSettings {
    manualValidation?: boolean;
}

export type InferZodType<T extends z.ZodType | undefined> = T extends z.ZodType
    ? z.infer<T>
    : unknown;

export type WithContractTypeParams<
    TConfig extends RouteContract,
    TSettings extends WithContractSettings | undefined = undefined,
    TBodySchema extends z.ZodType = TConfig['request'] extends {body: infer U}
        ? U extends z.ZodType
            ? U
            : z.ZodType<unknown>
        : z.ZodType<unknown>,
    TParamsSchema extends z.ZodType = TConfig['request'] extends {params: infer U}
        ? U extends z.ZodType
            ? U
            : z.ZodType<unknown>
        : z.ZodType<unknown>,
    TQuerySchema extends z.ZodType = TConfig['request'] extends {query: infer U}
        ? U extends z.ZodType
            ? U
            : z.ZodType<unknown>
        : z.ZodType<unknown>,
    THeadersSchema extends z.ZodType = TConfig['request'] extends {headers: infer U}
        ? U extends z.ZodType
            ? U
            : z.ZodType<unknown>
        : z.ZodType<unknown>,
    TBody = InferZodType<TBodySchema>,
    TParams = InferZodType<TParamsSchema>,
    TQuery = InferZodType<TQuerySchema>,
    THeaders = InferZodType<THeadersSchema>,
> = {
    IsManualActual: IsManualValidation<TSettings>;
    TBody: TBody;
    TParams: TParams;
    TQuery: TQuery;
    THeaders: THeaders;
};

// Helper type for getting the manual validation status
export type IsManualValidation<
    // We don't need the TConfig parameter anymore since manualValidation is in settings
    TSettings extends WithContractSettings | undefined = undefined,
> = TSettings extends {manualValidation: true} ? true : false;

export type ContractResponse<TConfig extends RouteContract> = BaseContractResponse &
    TypedResponseMethods<TConfig['response']['content']>;

export interface ErrorContract {
    errors: {
        contentType?: string;
        content: Record<
            number,
            {
                name?: string;
                schema: z.ZodType;
                description?: string;
            }
        >;
    };
}

// Helper to extract the actual Zod schema from an error definition
export type ExtractSchemaFromErrorDef<TDef> = TDef extends {schema: infer S}
    ? S extends z.ZodType
        ? S
        : never
    : never;

// Helper to infer data type from an error definition
export type InferDataFromErrorDef<TDef> =
    ExtractSchemaFromErrorDef<TDef> extends never
        ? undefined
        : z.infer<ExtractSchemaFromErrorDef<TDef>>;

// Interface for the error response methods that will be typed based on ErrorContract['errors']['content']
interface ErrorResponseMethods<TContent extends Record<number, {schema: z.ZodType}>> {
    // Status code key is number
    sendError: <
        S extends keyof TContent, // S is the status code (number)
        // D is the actual data type being passed, constrained by the schema for status code S
        D extends InferDataFromErrorDef<TContent[S]> = InferDataFromErrorDef<TContent[S]>,
    >(
        statusCode: S,
        data: Exact<InferDataFromErrorDef<TContent[S]>, D>,
    ) => void;
}

export type ErrorResponse<TConfig extends ErrorContract> = Response &
    ErrorResponseMethods<TConfig['errors']['content']>;
