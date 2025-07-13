# ExpressKit Security Schemes for OpenAPI Documentation

This document explains how to use the security scheme functionality in ExpressKit to enhance your OpenAPI documentation.

## Overview

ExpressKit now supports automatic generation of security requirements in OpenAPI documentation based on the authentication handlers used in your routes. This is achieved through a higher-order component (HOC) approach similar to the existing `withContract` functionality.

## Features

- **WeakMap-based Registry**: Security schemes are stored in a WeakMap to associate them with authentication handlers.
- **HOC Wrappers**: `withSecurityScheme` allows you to add security metadata to any authentication handler.
- **Predefined Security Schemes**: Ready-to-use wrappers for common authentication types:
  - `bearerAuth`: JWT/Bearer token authentication
  - `apiKeyAuth`: API key authentication
  - `basicAuth`: Basic authentication
  - `oauth2Auth`: OAuth2 authentication
  - `oidcAuth`: OpenID Connect authentication
- **Automatic Documentation**: Security requirements are automatically included in OpenAPI documentation.

## Usage

### Basic Usage

```typescript
import {bearerAuth} from 'expresskit';
import jwt from 'jsonwebtoken';

// Add OpenAPI security scheme metadata to your auth handler
const jwtAuthHandler = bearerAuth('myJwtAuth')(
  function authenticate(req, res, next) {
    // Your authentication logic here
    // ...
    next();
  }
);

// Use in routes
const routes = {
  'GET /api/protected': {
    handler: protectedRouteHandler,
    authHandler: jwtAuthHandler
  }
};
```

### Available Security Scheme Types

#### Bearer Token Authentication

```typescript
const jwtAuthHandler = bearerAuth(
  'jwtAuth', // scheme name in OpenAPI docs
  ['read:users', 'write:users'] // optional scopes
)(authFunction);
```

#### API Key Authentication

```typescript
const apiKeyHandler = apiKeyAuth(
  'apiKeyAuth', // scheme name
  'header', // location: 'header', 'query', or 'cookie'
  'X-API-Key', // parameter name
  ['read', 'write'] // optional scopes
)(authFunction);
```

#### Basic Authentication

```typescript
const basicAuthHandler = basicAuth(
  'basicAuth', // scheme name
  ['read', 'write'] // optional scopes
)(authFunction);
```

#### OAuth2 Authentication

```typescript
const oauth2Handler = oauth2Auth(
  'oauth2Auth', // scheme name
  {
    implicit: {
      authorizationUrl: 'https://example.com/oauth/authorize',
      scopes: {
        'read': 'Read access',
        'write': 'Write access'
      }
    }
  },
  ['read', 'write'] // optional scopes for this specific handler
)(authFunction);
```

#### OpenID Connect Authentication

```typescript
const oidcHandler = oidcAuth(
  'oidcAuth', // scheme name
  'https://example.com/.well-known/openid-configuration',
  ['profile', 'email'] // optional scopes
)(authFunction);
```

### Custom Security Schemes

If you need a custom security scheme, you can use the `withSecurityScheme` function directly:

```typescript
import {withSecurityScheme} from 'expresskit';

const customAuthHandler = withSecurityScheme({
  name: 'myCustomScheme',
  scheme: {
    type: 'http',
    scheme: 'digest',
    description: 'Digest authentication'
  },
  scopes: ['read', 'write']
})(authFunction);
```

## How It Works

1. When you wrap an authentication handler with one of the security scheme HOCs, it registers the scheme definition in a WeakMap.
2. The router detects when a route uses an auth handler with a registered security scheme.
3. The scheme is added to the OpenAPI components.securitySchemes section.
4. A security requirement referencing the scheme is added to the route operation.

## Best Practices

1. **Consistent Naming**: Use consistent names for your security schemes.
2. **Documentation**: Add descriptions to your security schemes to explain the required format.
3. **Scopes**: When using OAuth2 or scoped tokens, be specific about which scopes are required for each endpoint.
4. **Auth Policy**: The security requirement is only added if the route's auth policy is not disabled.

## Example

See the `/src/validator/example-security.ts` file for a complete example of how to use security schemes.
