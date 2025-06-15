import { ObjectSchema } from 'zod/dist/types/v4/core/json-schema';
import type {OpenApiRegistryConfig} from './types';
import { ApiRouteConfig } from './types';
import { z } from 'zod/v4';

interface RegisteredRoute {
    path: string;
    method: string;
    config: ApiRouteConfig;
}

export class OpenApiRegistry {
    private config: OpenApiRegistryConfig;
    private routes: RegisteredRoute[] = [];

    constructor(config: OpenApiRegistryConfig) {
        this.config = config;
    }

    public registerRoute(route: { path: string; method: string; config: ApiRouteConfig; }): void {
        this.routes.push({
            path: route.path,
            method: route.method.toLowerCase(),
            config: route.config
        });
    }

    // must return a valid OpenAPI schema object
    public getOpenApiSchema() {
        const openApiSchema = {
            openapi: '3.0.3',
            info: {
                title: this.config.title || 'API Documentation',
                version: this.config.version || '1.0.0',
                description: this.config.description || 'Generated API documentation'
            },
            servers: this.config.servers || [{ url: 'http://localhost:3030' }],
            paths: {} as Record<string, any>,
            components: {
                schemas: {} as Record<string, any>
            }
        };

        // Process each registered route
        this.routes.forEach(route => {
            const pathItem = openApiSchema.paths[route.path] || {};
            
            const operation: any = {
                summary: route.config.summary,
                description: route.config.description,
                tags: route.config.tags,
                parameters: [],
                responses: {}
            };

            // Add query parameters
            if (route.config.request?.query) {
                const querySchema = z.toJSONSchema(route.config.request.query);
                
                if (querySchema.type === 'object' && querySchema.properties) {
                    Object.entries(querySchema.properties).forEach(([name, schema]) => {
                        operation.parameters.push({
                            name,
                            in: 'query',
                            required: (querySchema as ObjectSchema).required?.includes(name) || false,
                            schema
                        });
                    });
                }
            }

            // Add path parameters
            if (route.config.request?.params) {
                const paramsSchema = z.toJSONSchema(route.config.request.params);
                if (paramsSchema.type === 'object' && paramsSchema.properties) {
                    Object.entries(paramsSchema.properties).forEach(([name, schema]) => {
                        operation.parameters.push({
                            name,
                            in: 'path',
                            required: true,
                            schema
                        });
                    });
                }
            }

            // Add request body for methods that support it
            if (['post', 'put', 'patch'].includes(route.method) && route.config.request?.body) {
                const bodySchema = z.toJSONSchema(route.config.request.body);
                operation.requestBody = {
                    required: true,
                    content: {
                        'application/json': {
                            schema: bodySchema
                        }
                    }
                };
            }

            // Add responses
            if (route.config.responses) {
                Object.entries(route.config.responses).forEach(([statusCode, responseDef]) => {
                    const schema = z.toJSONSchema(responseDef.schema);
                    operation.responses[statusCode] = {
                        description: responseDef.description || this.getResponseDescription(statusCode),
                        content: {
                            'application/json': {
                                schema
                            }
                        }
                    };
                });
            } else {
                // Default response if none specified
                operation.responses['200'] = {
                    description: 'Successful response',
                    content: {
                        'application/json': {
                            schema: { type: 'object' }
                        }
                    }
                };
            }

            pathItem[route.method] = operation;
            openApiSchema.paths[route.path] = pathItem;
        });

        return openApiSchema;
    }

    private getResponseDescription(statusCode: string): string {
        const descriptions: Record<string, string> = {
            '200': 'Successful response',
            '201': 'Created successfully',
            '204': 'No content',
            '400': 'Bad request',
            '401': 'Unauthorized',
            '403': 'Forbidden',
            '404': 'Not found',
            '422': 'Validation error',
            '500': 'Internal server error'
        };
        return descriptions[statusCode] || 'Response';
    }
}