import {Request as ExpressRequest, Response} from 'express';
import {z} from 'zod/v4';
import {ValidationError, ResponseValidationError} from './errors';
import {
    ApiRequest,
    ApiResponse,
    ApiRouteConfig,
    BaseApiResponse,
    Exact,
    WithApiTypeParams,
    IsManualValidation,
    HasResponseSchemaType
} from './types';

export {ValidationError, ResponseValidationError} from './errors';
export * from './types';

// withApi function definition
export function withApi<TConfig extends ApiRouteConfig>(config: TConfig) {
    // Use the type utilities from types.ts
    type Params = WithApiTypeParams<TConfig>;
    type IsManualActual = IsManualValidation<TConfig>;
    type HasResponseSchema = HasResponseSchemaType<TConfig>;
    
    return function (
        handler: (
            req: ApiRequest<IsManualActual, Params['TBody'], Params['TParams'], Params['TQuery'], Params['THeaders']>,
            res: ApiResponse<Params['TResponse'], HasResponseSchema>,
        ) => Promise<void> | void,
    ) {
        return async (expressReq: ExpressRequest, expressRes: Response) => {
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

                // If no schemas are defined, return empty objects for all parts
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
                    // result.error will contain aggregated errors from all parts
                    throw new ValidationError('Invalid request data', result.error);
                }

                // Initialize with defaults, then override with validated data if present
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

            // Automatically validate request parts unless manual validation is specified
            if (config.manualValidation !== true) {
                const validatedData = await enhancedReq.validate();
                // Assign validated data using type assertions to satisfy the conditional types
                (enhancedReq as { body: Params['TBody'] }).body = validatedData.body;
                (enhancedReq as { params: Params['TParams'] }).params = validatedData.params;
                (enhancedReq as { query: Params['TQuery'] }).query = validatedData.query;
                (enhancedReq as { headers: Params['THeaders'] }).headers = validatedData.headers;
            }
            // If manual mode (IsManualActual is true), or no schema for a part,
            // the respective part on enhancedReq remains from expressReq.
            // This aligns with the conditional types for enhancedReq properties.

            // Create base response without serialization methods
            const enhancedRes = expressRes as BaseApiResponse;
            
            // Add serialization methods only if response schema is defined
            if (config.response) {
                // Cast to API response with schema
                const typedRes = enhancedRes as ApiResponse<Params['TResponse'], true>;
                
                // @ts-ignore
                typedRes.typedJson = function <D extends Params['TResponse']>(
                    data: Exact<Params['TResponse'], D>,
                ): void {
                    (expressRes as Response).json(data);
                };
                
                // Add serialize method
                typedRes.serialize = function <D extends Params['TResponse']>(
                    data: D,
                ): void {
                    // Validate response data against the schema
                    const result = config.response!.safeParse(data);
                
                    if (!result.success) {
                        // If validation fails, throw an error to be handled by the global error handler
                        throw new ResponseValidationError('Invalid response data', result.error);
                    }
                    
                    // If validation passes, respond with the validated data
                    (expressRes as Response).json(result.data);
                };
            }

            await handler(enhancedReq, enhancedRes as ApiResponse<Params['TResponse'], HasResponseSchema>);
        };
    };
}
