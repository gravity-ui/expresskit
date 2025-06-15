import {Request as ExpressRequest, Response} from 'express';
import {z, ZodError} from 'zod/v4'; // Import ZodError
import {ValidationError, ResponseValidationError} from './errors';
import {
    ApiRequest,
    ApiResponse,
    ApiRouteConfig,
    Exact,
    WithApiTypeParams,
    IsManualValidation,
    InferDataFromResponseDef,
} from './types';

export {ValidationError, ResponseValidationError} from './errors';
export * from './types';

export function withApi<TConfig extends ApiRouteConfig>(config: TConfig) {
    type Params = WithApiTypeParams<TConfig>;
    type IsManualActual = IsManualValidation<TConfig>;
    
    return function (
        handler: (
            req: ApiRequest<IsManualActual, Params['TBody'], Params['TParams'], Params['TQuery'], Params['THeaders']>,
            res: ApiResponse<TConfig>,
        ) => Promise<void> | void,
    ) {
        const finalHandler = async (expressReq: ExpressRequest, expressRes: Response) => {
            const enhancedReq = expressReq as ApiRequest<IsManualActual, Params['TBody'], Params['TParams'], Params['TQuery'], Params['THeaders']>;

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

                if (Object.keys(shape).length === 0) {
                    return {
                        body: {} as Params['TBody'],
                        params: {} as Params['TParams'],
                        query: {} as Params['TQuery'],
                        headers: {} as Params['THeaders'],
                    };
                }

                const combinedSchema = z.object(shape);
                const result = await combinedSchema.safeParseAsync(dataToValidate);

                if (!result.success) {
                    throw new ValidationError('Invalid request data', result.error);
                }

                const validatedData = result.data as { 
                    body?: Params['TBody'], 
                    params?: Params['TParams'], 
                    query?: Params['TQuery'], 
                    headers?: Params['THeaders'] 
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

            const enhancedRes = expressRes as ApiResponse<TConfig>; // Cast directly to the new ApiResponse<TConfig>
            
            enhancedRes.typedJson = function <
                S extends keyof TConfig['responses'],
                D extends InferDataFromResponseDef<TConfig['responses'][S]>
            >(
                statusCode: S,
                data: Exact<InferDataFromResponseDef<TConfig['responses'][S]>, D>
            ): void {
                expressRes.status(statusCode as number).json(data);
            };
            
            enhancedRes.serialize = function <S extends keyof TConfig['responses']>(
                statusCode: S,
                data: InferDataFromResponseDef<TConfig['responses'][S]> 
            ): void {
                const responseDef = config.responses[statusCode as number]; 

                const schemaToValidate = responseDef.schema; 
                const result = schemaToValidate.safeParse(data);
            
                if (!result.success) {
                    throw new ResponseValidationError(
                        `Invalid response data for status code ${String(statusCode)}`,
                        result.error
                    );
                }
                expressRes.status(statusCode as number).json(result.data);
            };

            try {
                // Automatically validate request parts unless manual validation is specified
                if (config.manualValidation !== true) {
                    const validatedData = await enhancedReq.validate();
                    // Assign validated data using type assertions to satisfy the conditional types
                    (enhancedReq as { body: Params['TBody'] }).body = validatedData.body;
                    (enhancedReq as { params: Params['TParams'] }).params = validatedData.params;
                    (enhancedReq as { query: Params['TQuery'] }).query = validatedData.query;
                    (enhancedReq as { headers: Params['THeaders'] }).headers = validatedData.headers;
                }
            
                await handler(enhancedReq, enhancedRes);
            } catch (error: any) {
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
                } else if (error instanceof ResponseValidationError) {
                    const zodError = error.details as ZodError | undefined;
                    // Log the server-side error
                    console.error(
                        'ResponseValidationError: Failed to serialize response.',
                        {
                            routeName: config.name,
                            message: error.message,
                            issues: zodError?.issues,
                        }
                    );
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

        // Attach apiConfig for OpenAPI generator
        (finalHandler as any).apiConfig = config;

        return finalHandler;
    };
}
