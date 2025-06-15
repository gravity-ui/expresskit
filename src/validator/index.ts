import {Request as ExpressRequest, Response} from 'express';
import {z} from 'zod/v4';
import {ValidationError, ResponseValidationError} from './errors';
import {
    ApiRequest,
    ApiResponse, // This will now be ApiResponse<TConfig>
    ApiRouteConfig,
    Exact,
    WithApiTypeParams,
    IsManualValidation,
    // InferZodType, // No longer needed here if using InferDataFromResponseDef
    ExtractSchemaFromResponseDef,
    InferDataFromResponseDef // Ensure this is imported
} from './types';

export {ValidationError, ResponseValidationError} from './errors';
export * from './types';

// withApi function definition
export function withApi<TConfig extends ApiRouteConfig>(config: TConfig) {
    // Use the type utilities from types.ts
    type Params = WithApiTypeParams<TConfig>;
    type IsManualActual = IsManualValidation<TConfig>;
    
    return function (
        handler: (
            req: ApiRequest<IsManualActual, Params['TBody'], Params['TParams'], Params['TQuery'], Params['THeaders']>,
            // ApiResponse now takes TConfig directly to infer typedJson/serialize methods
            res: ApiResponse<TConfig>,
        ) => Promise<void> | void,
    ) {
        // Attach the apiConfig to the handler function itself for OpenAPI generation
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
            const enhancedRes = expressRes as ApiResponse<TConfig>; // Cast directly to the new ApiResponse<TConfig>
            
            // Since config.responses is now mandatory, the 'if (config.responses)' check can be removed.
            // The methods typedJson and serialize are always part of ApiResponse<TConfig>.

            enhancedRes.typedJson = function <
                S extends keyof TConfig['responses'],
                // D is the actual data type being passed, constrained by the schema for status code S
                // Use InferDataFromResponseDef directly, matching TypedResponseMethods
                D extends InferDataFromResponseDef<TConfig['responses'][S]>
            >(
                statusCode: S,
                data: Exact<InferDataFromResponseDef<TConfig['responses'][S]>, D>
            ): void {
                expressRes.status(statusCode as number).json(data);
            };
            
            enhancedRes.serialize = function <S extends keyof TConfig['responses']>(
                statusCode: S,
                // Use InferDataFromResponseDef directly, matching TypedResponseMethods
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

            await handler(enhancedReq, enhancedRes);
        };

        // Attach apiConfig for OpenAPI generator
        (finalHandler as any)._apiConfig = config;
        return finalHandler;
    };
}
