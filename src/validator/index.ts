import {Request as ExpressRequest, Response} from 'express';
import {ZodError, z} from 'zod/v4'; // Import ZodError
import {SerializationError, ValidationError} from './errors';
import {
    ContractRequest,
    ContractResponse,
    Exact,
    InferDataFromResponseDef,
    IsManualValidation,
    RouteContract,
    WithApiTypeParams,
} from './types';
import {AppRouteHandler} from '../types';
import {registerContract} from './contractRegistry';

export {ValidationError, SerializationError} from './errors';
export {OpenApiRegistry} from './openapi-registry';
export * from './types';
export {getContract, getRouteContract, registerContract} from './contractRegistry';
export {
    withSecurityScheme,
    getSecurityScheme,
    registerSecurityScheme,
    bearerAuth,
    apiKeyAuth,
    basicAuth,
    oauth2Auth,
    oidcAuth,
} from './securitySchemes';

export function withContract<TConfig extends RouteContract>(config: TConfig) {
    type Params = WithApiTypeParams<TConfig>;
    type IsManualActual = IsManualValidation<TConfig>;

    const requestShape: Record<string, z.ZodType> = {};
    if (config.request?.body) {
        requestShape.body = config.request.body;
    }
    if (config.request?.params) {
        requestShape.params = config.request.params;
    }
    if (config.request?.query) {
        requestShape.query = config.request.query;
    }
    if (config.request?.headers) {
        requestShape.headers = config.request.headers;
    }

    const combinedRequestSchema =
        Object.keys(requestShape).length > 0 ? z.object(requestShape) : null;

    return function (
        handler: (
            req: ContractRequest<
                IsManualActual,
                Params['TBody'],
                Params['TParams'],
                Params['TQuery'],
                Params['THeaders']
            >,
            res: ContractResponse<TConfig>,
        ) => Promise<void> | void,
    ) {
        const finalHandler: AppRouteHandler = async (
            expressReq: ExpressRequest,
            expressRes: Response,
        ) => {
            const enhancedReq = expressReq as ContractRequest<
                IsManualActual,
                Params['TBody'],
                Params['TParams'],
                Params['TQuery'],
                Params['THeaders']
            >;

            enhancedReq.validate = async () => {
                if (!combinedRequestSchema) {
                    return {
                        body: {} as Params['TBody'],
                        params: {} as Params['TParams'],
                        query: {} as Params['TQuery'],
                        headers: {} as Params['THeaders'],
                    };
                }

                const dataToValidate = {
                    body: expressReq.body,
                    params: expressReq.params,
                    query: expressReq.query,
                    headers: expressReq.headers,
                };

                const result = await combinedRequestSchema.safeParseAsync(dataToValidate);

                if (!result.success) {
                    throw new ValidationError('Invalid request data', result.error);
                }

                const validatedData = result.data as {
                    body?: Params['TBody'];
                    params?: Params['TParams'];
                    query?: Params['TQuery'];
                    headers?: Params['THeaders'];
                };

                let body: Params['TBody'] = {} as Params['TBody'];
                let params: Params['TParams'] = {} as Params['TParams'];
                let query: Params['TQuery'] = {} as Params['TQuery'];
                let headers: Params['THeaders'] = {} as Params['THeaders'];

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

            const enhancedRes = expressRes as ContractResponse<TConfig>;

            enhancedRes.sendTyped = function <
                S extends keyof TConfig['response']['content'],
                D extends InferDataFromResponseDef<TConfig['response']['content'][S]>,
            >(
                statusCode: S,
                data: Exact<InferDataFromResponseDef<TConfig['response']['content'][S]>, D>,
            ): void {
                expressRes.status(statusCode as number).json(data);
            };

            enhancedRes.sendValidated = function <S extends keyof TConfig['response']['content']>(
                statusCode: S,
                data: InferDataFromResponseDef<TConfig['response']['content'][S]>,
            ): void {
                const responseDef = config.response.content[statusCode as number];

                const schemaToValidate = responseDef.schema;
                const result = schemaToValidate.safeParse(data);

                if (!result.success) {
                    throw new SerializationError(
                        `Invalid response data for status code ${String(statusCode)}`,
                        result.error,
                    );
                }
                expressRes.status(statusCode as number).json(result.data);
            };

            try {
                if (config.request?.body) {
                    const contentType = expressReq.headers['content-type'];
                    const allowedContentTypes = config.request?.contentType ?? ['application/json'];

                    if (
                        !contentType ||
                        !allowedContentTypes.some((type) => contentType.includes(type))
                    ) {
                        throw new ValidationError(
                            `Unsupported content-type. Allowed: ${allowedContentTypes.join(', ')}`,
                        );
                    }
                }

                // Automatically validate request parts unless manual validation is specified
                if (config.manualValidation !== true) {
                    const validatedData = await enhancedReq.validate();
                    // Assign validated data using type assertions to satisfy the conditional types
                    (enhancedReq as {body: Params['TBody']}).body = validatedData.body;
                    (enhancedReq as {params: Params['TParams']}).params = validatedData.params;
                    (enhancedReq as {query: Params['TQuery']}).query = validatedData.query;
                    (enhancedReq as {headers: Params['THeaders']}).headers = validatedData.headers;
                }

                await handler(enhancedReq, enhancedRes);
            } catch (error: unknown) {
                if (error instanceof ValidationError) {
                    if (!expressRes.headersSent) {
                        const zodError = error.details as ZodError | undefined;
                        expressRes.status(error.statusCode || 400).json({
                            error: error.message || 'Validation error',
                            code: 'VALIDATION_ERROR',
                            issues: zodError?.issues.map((issue: z.ZodIssue) => ({
                                path: issue.path,
                                message: issue.message,
                                code: issue.code,
                            })),
                        });
                    }
                } else if (error instanceof SerializationError) {
                    if (!expressRes.headersSent) {
                        expressRes.status(error.statusCode || 500).json({
                            error: 'Internal Server Error',
                            code: 'RESPONSE_SERIALIZATION_FAILED',
                        });
                    }
                } else {
                    // For any other errors, re-throw them to be handled by Express's general error handlers
                    throw error;
                }
            }
        };

        // Store in WeakMap
        registerContract(finalHandler, config);

        return finalHandler;
    };
}
