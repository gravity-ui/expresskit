import type {AppAuthHandler} from '../types';
import type {SecuritySchemeObject} from './types';

// WeakMap to store security scheme definitions for auth handlers
const securitySchemesRegistry = new WeakMap<AppAuthHandler, SecuritySchemeDefinition>();

export interface SecuritySchemeDefinition {
    name: string;
    scheme: SecuritySchemeObject;
    scopes?: string[];
}

/**
 * Register a security scheme for an auth handler
 */
export function registerSecurityScheme(
    handler: AppAuthHandler,
    definition: SecuritySchemeDefinition,
): void {
    securitySchemesRegistry.set(handler, definition);
}

/**
 * Get the security scheme for an auth handler
 */
export function getSecurityScheme(
    handler: AppAuthHandler,
): SecuritySchemeDefinition | undefined {
    return securitySchemesRegistry.get(handler);
}

/**
 * Higher-Order Component to add security scheme to an auth handler
 */
export function withSecurityScheme(definition: SecuritySchemeDefinition) {
    return function <T extends AppAuthHandler>(handler: T): T {
        registerSecurityScheme(handler, definition);
        return handler;
    };
}

/**
 * Bearer token authentication
 */
export function bearerAuth(name: string = 'bearerAuth', scopes?: string[]) {
    return withSecurityScheme({
        name,
        scheme: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
        },
        scopes,
    });
}

/**
 * API key authentication
 */
export function apiKeyAuth(
    name: string = 'apiKey',
    in_: 'header' | 'query' | 'cookie' = 'header',
    paramName: string = 'X-API-Key',
    scopes?: string[],
) {
    return withSecurityScheme({
        name,
        scheme: {
            type: 'apiKey',
            in: in_,
            name: paramName,
        },
        scopes,
    });
}

/**
 * Basic authentication
 */
export function basicAuth(name: string = 'basicAuth', scopes?: string[]) {
    return withSecurityScheme({
        name,
        scheme: {
            type: 'http',
            scheme: 'basic',
        },
        scopes,
    });
}

/**
 * OAuth2 authentication
 */
export function oauth2Auth(
    name: string = 'oauth2Auth',
    flows: SecuritySchemeObject['flows'],
    scopes?: string[],
) {
    return withSecurityScheme({
        name,
        scheme: {
            type: 'oauth2',
            flows,
        },
        scopes,
    });
}

/**
 * OpenID Connect authentication
 */
export function oidcAuth(name: string = 'oidcAuth', openIdConnectUrl: string, scopes?: string[]) {
    return withSecurityScheme({
        name,
        scheme: {
            type: 'openIdConnect',
            openIdConnectUrl,
        },
        scopes,
    });
}
