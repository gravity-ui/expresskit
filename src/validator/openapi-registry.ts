import type {OpenApiRegistryConfig, OpenApiSchemaObject, SecuritySchemeObject} from './types';

import {RouteContract} from './types';
import {z} from 'zod/v4';
import {AppMiddleware, AppRouteHandler, HttpMethod} from '../types';
import {getRouteContract} from './contractRegistry';
import {getSecurityScheme} from './securitySchemes';

interface RegisteredRoute {
    path: string;
    method: string;
    config: RouteContract;
    security?: Array<Record<string, string[]>>;
}

export class OpenApiRegistry {
    private config: OpenApiRegistryConfig;
    private routes: RegisteredRoute[] = [];
    private securitySchemes: Record<string, SecuritySchemeObject> = {};
    private cachedSchema: OpenApiSchemaObject | null = null;

    constructor(config: OpenApiRegistryConfig) {
        this.config = config;
    }

    registerSecurityScheme(name: string, scheme: SecuritySchemeObject): void {
        this.securitySchemes[name] = scheme;
        this.cachedSchema = null;
    }

    registerRoute(
        method: HttpMethod,
        routePath: string,
        routeHandler: AppRouteHandler,
        authHandler?: AppMiddleware,
    ): void {
        const apiConfig = getRouteContract(routeHandler);
        if (!apiConfig) return;

        const security = [];

        if (authHandler) {
            const securityScheme = getSecurityScheme(authHandler);

            if (securityScheme) {
                this.registerSecurityScheme(securityScheme.name, securityScheme.scheme);

                security.push({
                    [securityScheme.name]: securityScheme.scopes || [],
                });
            }
        }

        const openApiPath = routePath.replace(/\/:([^/]+)/g, '/{$1}');
        this.routes.push({
            path: openApiPath,
            method: method.toLowerCase(),
            config: apiConfig,
            security: security.length > 0 ? security : undefined,
        });
        this.cachedSchema = null;
    }

    getOpenApiSchema(): OpenApiSchemaObject {
        if (this.cachedSchema) {
            return this.cachedSchema;
        }

        const openApiSchema = {
            openapi: '3.0.3',
            info: {
                title: this.config.title || 'API Documentation',
                version: this.config.version || '1.0.0',
                description: this.config.description || 'Generated API documentation',
            },
            servers: this.config.servers || [{url: 'http://localhost:3030'}],
            paths: {} as Record<string, Record<string, unknown>>,
            components: {
                schemas: {} as Record<string, unknown>,
                securitySchemes: this.securitySchemes,
            },
        };

        // Process each registered route
        this.routes.forEach((route) => {
            const pathItem = openApiSchema.paths[route.path] || {};

            const operation: Record<string, unknown> = {
                summary: route.config.summary,
                description: route.config.description,
                tags: route.config.tags,
                parameters: [],
                responses: {},
            };

            // Add security requirements if present
            if (route.security && route.security.length > 0) {
                operation.security = route.security;
            }

            // Add query parameters
            if (route.config.request?.query) {
                const querySchema = z.toJSONSchema(route.config.request.query);

                if (querySchema.type === 'object' && querySchema.properties) {
                    Object.entries(querySchema.properties).forEach(([name, schema]) => {
                        (operation.parameters as Record<string, unknown>[]).push({
                            name,
                            in: 'query',
                            required:
                                (querySchema as {required?: string[]}).required?.includes(name) ||
                                false,
                            schema,
                        });
                    });
                }
            }

            // Add path parameters
            if (route.config.request?.params) {
                const paramsSchema = z.toJSONSchema(route.config.request.params);
                if (paramsSchema.type === 'object' && paramsSchema.properties) {
                    Object.entries(paramsSchema.properties).forEach(([name, schema]) => {
                        (operation.parameters as Record<string, unknown>[]).push({
                            name,
                            in: 'path',
                            required: true,
                            schema,
                        });
                    });
                }
            }

            // Add request body for methods that support it
            if (['post', 'put', 'patch'].includes(route.method) && route.config.request?.body) {
                const bodySchema = z.toJSONSchema(route.config.request.body);
                const contentTypes = route.config.request?.contentType || ['application/json'];
                const content = contentTypes.reduce(
                    (acc, type) => {
                        acc[type] = {
                            schema: bodySchema,
                        };
                        return acc;
                    },
                    {} as Record<string, {schema: unknown}>,
                );

                operation.requestBody = {
                    required: true,
                    content,
                };
            }

            // Add responses
            if (route.config.response) {
                Object.entries(route.config.response.content).forEach(
                    ([statusCode, responseDef]) => {
                        const schema = z.toJSONSchema(responseDef.schema);
                        const contentType =
                            route.config.response?.contentType || 'application/json';
                        (operation.responses as Record<string, unknown>)[statusCode] = {
                            description:
                                responseDef.description || this.getResponseDescription(statusCode),
                            content: {
                                [contentType]: {
                                    schema,
                                },
                            },
                        };
                    },
                );
            } else {
                // Default response if none specified
                (operation.responses as Record<string, unknown>)['200'] = {
                    description: 'Successful response',
                    content: {
                        'application/json': {
                            schema: {type: 'object'},
                        },
                    },
                };
            }

            pathItem[route.method] = operation;
            openApiSchema.paths[route.path] = pathItem;
        });

        this.cachedSchema = openApiSchema;

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
            '500': 'Internal server error',
        };
        return descriptions[statusCode] || 'Response';
    }
}
