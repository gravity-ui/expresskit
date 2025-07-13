import {Request as ExpressRequest, Response} from 'express';
import {z} from 'zod/v4';

// OpenAPI Security Scheme Object types
export interface SecuritySchemeObject {
    type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
    description?: string;

    // apiKey
    in?: 'query' | 'header' | 'cookie';
    name?: string;

    // http
    scheme?: string;
    bearerFormat?: string;

    // oauth2
    flows?: {
        implicit?: {
            authorizationUrl: string;
            refreshUrl?: string;
            scopes: Record<string, string>;
        };
        password?: {
            tokenUrl: string;
            refreshUrl?: string;
            scopes: Record<string, string>;
        };
        clientCredentials?: {
            tokenUrl: string;
            refreshUrl?: string;
            scopes: Record<string, string>;
        };
        authorizationCode?: {
            authorizationUrl: string;
            tokenUrl: string;
            refreshUrl?: string;
            scopes: Record<string, string>;
        };
    };

    // openIdConnect
    openIdConnectUrl?: string;
}

export interface OpenApiRegistryConfig {
    enabled?: boolean;
    path?: string;
    version?: string;
    title?: string;
    description?: string;
    contact?: {
        name?: string;
        email?: string;
        url?: string;
    };
    license?: {
        name?: string;
        url?: string;
    };
    servers?: {
        url: string;
        description?: string;
    }[];
}

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
export type ExtractSchemaFromResponseDef<TDef> = TDef extends {schema: infer S} // Simplified: TDef is always an object with a schema
    ? S extends z.ZodType
        ? S
        : never
    : never;

// Helper to infer data type from a response definition - EXPORT THIS
export type InferDataFromResponseDef<TDef> = z.infer<ExtractSchemaFromResponseDef<TDef>>;

// Interface for the response methods that will be typed based on ApiRouteConfig['response']['content']
interface TypedResponseMethods<TContent extends Record<number, {schema: z.ZodType}>> {
    // Status code key is number
    sendTyped: <
        S extends keyof TContent, // S is the status code (number)
        // D is the actual data type being passed, constrained by the schema for status code S
        D extends InferDataFromResponseDef<TContent[S]>,
    >(
        statusCode: S,
        data: Exact<InferDataFromResponseDef<TContent[S]>, D>,
    ) => void;

    sendValidated: <S extends keyof TContent>(
        statusCode: S, // S is the status code (number)
        data: InferDataFromResponseDef<TContent[S]>, // Exact not always needed for serialize, but good for consistency
    ) => void;
}

export interface RouteContract {
    name?: string;
    operationId?: string;
    summary?: string;
    description?: string;
    tags?: string[];
    manualValidation?: boolean;
    request?: {
        body?: z.ZodType;
        params?: z.ZodType;
        query?: z.ZodType;
        headers?: z.ZodType;
        contentType?: string[];
    };
    response: {
        contentType?: string;
        content: Record<number, {schema: z.ZodType; description?: string}>;
    };
}

export type InferZodType<T extends z.ZodType | undefined> = T extends z.ZodType
    ? z.infer<T>
    : unknown;

export type WithApiTypeParams<
    TConfig extends RouteContract,
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
    IsManualActual: TConfig['manualValidation'] extends true ? true : false;
    TBody: TBody;
    TParams: TParams;
    TQuery: TQuery;
    THeaders: THeaders;
};

// Helper type for getting the manual validation status
export type IsManualValidation<TConfig extends RouteContract> =
    TConfig['manualValidation'] extends true ? true : false;

export type ApiHandler<
    TConfig extends RouteContract,
    P extends WithApiTypeParams<TConfig> = WithApiTypeParams<TConfig>,
> = (
    req: ContractRequest<P['IsManualActual'], P['TBody'], P['TParams'], P['TQuery'], P['THeaders']>,
    res: ContractResponse<TConfig>,
    next: (err?: Error) => void,
) => void | Promise<void>;

export type ContractResponse<TConfig extends RouteContract> = BaseContractResponse &
    TypedResponseMethods<TConfig['response']['content']>;
