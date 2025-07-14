# ExpressKit Validator

Provides request validation (body, params, query, headers) and response serialization and documentation using Zod schemas.

## Table of Contents

- [Quick Start: Automatic Validation](#quick-start-automatic-validation)
- [Core Concepts](#core-concepts)
  - [withContract Configuration](#withcontractconfighandler)
  - [Enhanced Request](#enhanced-request-contractrequest)
  - [Enhanced Response](#enhanced-response-contractresponse)
  - [Error Handling](#error-handling)
- [Security Schemes for OpenAPI Documentation](#security-schemes-for-openapi-documentation)
  - [Basic Usage](#basic-usage)
  - [Available Security Scheme Types](#available-security-scheme-types)
  - [Custom Security Schemes](#custom-security-schemes)
  - [How It Works](#how-it-works)
  - [Best Practices](#best-practices)

---

## Quick Start: Automatic Validation

Here's a common example of using `withContract` for automatic request validation and response serialization:

```typescript
import {ExpressKit, withContract, AppRoutes, RouteContract} from '@gravity-ui/expresskit';
import {NodeKit} from '@gravity-ui/nodekit';
import {z} from 'zod';

// Define your Zod schemas
const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string().datetime(),
});

const ErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
});

// Configure the API endpoint
const CreateTaskConfig = {
  name: 'CreateTask',
  operationId: 'createTaskOperation',
  summary: 'Creates a new task',
  request: {
    body: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }),
  },
  response: {
    content: {
      201: {
        schema: TaskSchema,
        description: 'Task created successfully.',
      },
      400: {
        schema: ErrorSchema,
        description: 'Invalid input data.',
      },
    },
  },
} satisfies RouteContract;

// Create your route handler, wrapped with withContract
const createTaskHandler = withContract(CreateTaskConfig)(async (req, res) => {
  // req.body is automatically validated and typed
  const {name, description} = req.body;

  const newTask = {
    id: 'task_' + Date.now(),
    name,
    description,
    createdAt: new Date().toISOString(),
  };

  // Validates response against TaskSchema and sends it
  res.sendValidated(201, newTask);
});

// Integrate with your Express/ExpressKit routes
const routes: AppRoutes = {
  'POST /tasks': createTaskHandler,
};

const nodekit = new NodeKit();
const app = new ExpressKit(nodekit, routes);
```

**Key takeaways:**

- Request body is automatically validated against your schema
- Inside the handler, `req.body` is typed according to your schema
- `res.sendValidated()` validates the response data against your schema
- If validation fails, appropriate errors are thrown and handled

---

## Core Concepts

The primary tool is the `withContract` higher-order function, which wraps Express route handlers to add validation, serialization, and type safety based on Zod schemas.

### `withContract(config)(handler)`

- **`config` (`RouteContract`)**: An object to configure validation behavior and OpenAPI documentation.

  ```typescript
  interface RouteContract {
    name?: string; // Descriptive name for logging/tracing
    operationId?: string; // Unique ID for the operation (e.g., for OpenAPI)
    summary?: string; // Short summary for OpenAPI
    description?: string; // Detailed description for OpenAPI
    tags?: string[]; // Tags for grouping (e.g., for OpenAPI)
    manualValidation?: boolean; // Default: false. If true, call req.validate() manually.
    request?: {
      contentType?: string | string[]; // Allowed request content types. Default: 'application/json'
      body?: z.ZodType<any>; // Schema for req.body
      params?: z.ZodType<any>; // Schema for req.params
      query?: z.ZodType<any>; // Schema for req.query
      headers?: z.ZodType<any>; // Schema for req.headers
    };
    // Define response schemas for various HTTP status codes. This field is MANDATORY.
    response: {
      contentType?: string; // The response content type. Default: 'application/json'
      content: Record<
        number,
        {
          schema: z.ZodType<any>; // Zod schema for this status code's response body
          description?: string; // Description for this response (e.g., for OpenAPI)
        }
      >;
    };
  }
  ```

  Key properties:

  - `manualValidation`: Set to `true` to disable automatic request validation.
  - `request`: Define Zod schemas for `body`, `params`, `query`, `headers`, and specify allowed `contentType`.
  - `response`: (Mandatory) An object containing:
    - `content`: A record where keys are HTTP status codes (e.g., `200`, `201`, `400`) and values are objects containing a `schema` (Zod schema for the response body) and an optional `description`.
    - `contentType`: An optional string to set the `Content-Type` header for all responses. Defaults to `application/json`.

- **`handler(req, res)`**: Your Express route handler, receiving enhanced `req` and `res` objects.

### Enhanced Request (`ContractRequest`)

The `req` object in your handler is enhanced:

- **Typed Properties**: `req.body`, `req.params`, `req.query`, `req.headers` are typed based on `RouteContract.request` schemas (if automatic validation is enabled and successful).
- **`req.validate(): Promise<ValidatedData>`**:
  - Call this asynchronous method if `manualValidation` is `true`.
  - Returns a promise resolving to an object with validated `body`, `params`, `query`, and `headers`.
  - Throws `ValidationError` on failure.

### Enhanced Response (`ContractResponse`)

The `res` object in your handler is enhanced with the following methods:

- **`res.sendTyped(statusCode, data)`**:

  - Sends a JSON response with the given `statusCode`.
  - The `data` argument is **type-checked** at compile time against the schema associated with `statusCode`.
  - It **does not perform runtime validation** or data transformation.
  - Useful if you are certain about the data's structure and want to skip validation overhead.

- **`res.sendValidated(statusCode, data)`**:
  - Sends a JSON response with the given `statusCode`.
  - **Performs runtime validation** of `data` against the schema associated with `statusCode`.
  - **Transforms data** according to that Zod schema (stripping extra fields, applying defaults, etc.).
  - Throws a `ResponseValidationError` if validation fails.
  - Use this method to ensure strict adherence to the API contract.

### Error Handling

- **`ValidationError`**:
  - Thrown by automatic request validation or manual `req.validate()` if request data is invalid.
  - Typically results in a 400 Bad Request.
  - Contains `details` with the Zod error.
- **`ResponseValidationError`**:
  - Thrown by `res.sendValidated(statusCode, data)` if response data doesn't match the schema.
  - Typically results in a 500 Internal Server Error.
  - Contains `details` with the Zod error.

These errors are caught by ExpressKit's default error handling middleware.

---

## Security Schemes for OpenAPI Documentation

ExpressKit supports automatic generation of security requirements in OpenAPI documentation based on the authentication handlers used in your routes.

### Features

- **HOC Wrappers**: `withSecurityScheme` allows you to add security metadata to any authentication handler.
- **Predefined Security Schemes**: Ready-to-use wrappers for common authentication types:
  - `bearerAuth`: JWT/Bearer token authentication
  - `apiKeyAuth`: API key authentication
  - `basicAuth`: Basic authentication
  - `oauth2Auth`: OAuth2 authentication
  - `oidcAuth`: OpenID Connect authentication
- **Automatic Documentation**: Security requirements are automatically included in OpenAPI documentation.

### Basic Usage

```typescript
import {bearerAuth} from 'expresskit';
import jwt from 'jsonwebtoken';

// Add OpenAPI security scheme metadata to your auth handler
const jwtAuthHandler = bearerAuth('myJwtAuth')(function authenticate(req, res, next) {
  // Your authentication logic here
  next();
});

// Use in routes
const routes = {
  'GET /api/protected': {
    handler: protectedRouteHandler,
    authHandler: jwtAuthHandler,
  },
};
```

### Available Security Scheme Types

#### Bearer Token Authentication

```typescript
const jwtAuthHandler = bearerAuth(
  'jwtAuth', // scheme name in OpenAPI docs
  ['read:users', 'write:users'], // optional scopes
)(authFunction);
```

#### API Key Authentication

```typescript
const apiKeyHandler = apiKeyAuth(
  'apiKeyAuth', // scheme name
  'header', // location: 'header', 'query', or 'cookie'
  'X-API-Key', // parameter name
  ['read', 'write'], // optional scopes
)(authFunction);
```

#### Basic Authentication

```typescript
const basicAuthHandler = basicAuth(
  'basicAuth', // scheme name
  ['read', 'write'], // optional scopes
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
        read: 'Read access',
        write: 'Write access',
      },
    },
  },
  ['read', 'write'], // optional scopes for this specific handler
)(authFunction);
```

#### OpenID Connect Authentication

```typescript
const oidcHandler = oidcAuth(
  'oidcAuth', // scheme name
  'https://example.com/.well-known/openid-configuration',
  ['profile', 'email'], // optional scopes
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
    description: 'Digest authentication',
  },
  scopes: ['read', 'write'],
})(authFunction);
```

### How It Works

1. When you wrap an authentication handler with one of the security scheme HOCs, it registers the scheme definition.
2. The router detects when a route uses an auth handler with a registered security scheme.
3. The scheme is added to the OpenAPI components.securitySchemes section.
4. A security requirement referencing the scheme is added to the route operation.

### Best Practices

1. **Consistent Naming**: Use consistent names for your security schemes.
2. **Documentation**: Add descriptions to your security schemes to explain the required format.
3. **Scopes**: When using OAuth2 or scoped tokens, be specific about which scopes are required for each endpoint.
4. **Auth Policy**: The security requirement is only added if the route's auth policy is not disabled.
