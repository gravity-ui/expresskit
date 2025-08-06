# ExpressKit Validator

Provides request validation (body, params, query, headers) and response serialization using Zod schemas.

## Table of Contents

- [Quick Start: Automatic Validation](#quick-start-automatic-validation)
- [Core Concepts](#core-concepts)
  - [withContract Configuration](#withcontractconfighandler)
  - [Enhanced Request](#enhanced-request-contractrequest)
  - [Enhanced Response](#enhanced-response-contractresponse)
  - [Error Handling Customization](#error-handling-customization)

---

## Quick Start: Automatic Validation

Here's a common example of using `withContract` for automatic request validation and response serialization:

```typescript
import {ExpressKit, withContract, AppRoutes, RouteContract} from '@gravity-ui/expresskit';
import {NodeKit} from '@gravity-ui/nodekit';
import {z} from 'zod/v4';

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

// Example with manual validation
const manualValidationHandler = withContract(CreateTaskConfig, {
  manualValidation: true,
})(async (req, res) => {
  // Need to manually validate since manualValidation is true
  const {body} = await req.validate();
  const {name, description} = body;

  const newTask = {
    id: 'task_' + Date.now(),
    name,
    description,
    createdAt: new Date().toISOString(),
  };

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

### `withContract(config, settings?)(handler)`

- **`config` (`RouteContract`)**: An object to configure validation behavior.

  ```typescript
  interface RouteContract {
    name?: string; // Descriptive name for logging/tracing
    operationId?: string; // Unique ID for the operation (e.g., for OpenAPI)
    summary?: string; // Short summary for OpenAPI
    description?: string; // Detailed description for OpenAPI
    tags?: string[]; // Tags for grouping (e.g., for OpenAPI)
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
          schema?: z.ZodType<any>; // Optional Zod schema for this status code's response body
          description?: string; // Description for this response
        }
      >;
    };
  }
  ```

- **`settings`**: Optional settings for the contract.

  ```typescript
  interface WithContractSettings {
    manualValidation?: boolean; // Default: false. If true, call req.validate() manually.
  }
  ```

  Key properties:

  - `manualValidation`: Set to `true` to disable automatic request validation.

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

- **`res.sendTyped(statusCode, data?)`**:

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

### Error Handling Customization

ExpressKit provides a powerful way to customize validation error handling through the combination of `withErrorContract` and `AppConfig.validationErrorHandler`:

#### Custom Error Handling with `withErrorContract` and `validationErrorHandler`

```typescript
import {
  withErrorContract,
  ErrorContract,
  ValidationError,
  ResponseValidationError
} from '@gravity-ui/expresskit';
import {z} from 'zod/v4;
import {NodeKit} from '@gravity-ui/nodekit';

// Define your error contract with typed error responses
const CustomErrorContract = {
  errors: {
    content: {
      400: {
        name: 'ValidationError',
        schema: z.object({
          error: z.string(),
          code: z.string(),
          details: z.array(z.string()).optional(),
          requestId: z.string(),
        }),
        description: 'Custom validation error format',
      },
      500: {
        name: 'ServerError',
        schema: z.object({
          error: z.string(),
          code: z.string(),
          requestId: z.string(),
        }),
        description: 'Server error',
      },
    },
  },
} satisfies ErrorContract;

const config: Partial<AppConfig> = {
  validationErrorHandler: (ctx) => {
    return withErrorContract(CustomErrorContract)((err, req, res, next) => {
      if (err instanceof ValidationError) {
        // Use type-safe res.sendError() from withErrorContract
        res.sendError(400, {
          error: 'Invalid input',
          code: 'CUSTOM_VALIDATION_ERROR',
          details: err.details?.issues?.map(issue => issue.message) || [],
          requestId: req.id,
        });
      } else if (err instanceof ResponseValidationError) {
        res.sendError(500, {
          error: 'Internal Server Error',
          code: 'RESPONSE_VALIDATION_FAILED',
          requestId: req.id,
        });
      } else {
        next(err);
      }
    });
  },
};
```
