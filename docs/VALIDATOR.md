# ExpressKit Validator

Provides request validation (body, params, query, headers) and response serialization and documentation using Zod schemas.

## Quick Start: Automatic Validation

Here's a common example of using `withApi` for automatic request validation and response serialization for a specific HTTP status code:

```typescript
import {ExpressKit, withApi, AppRoutes, ApiRouteConfig} from '@gravity-ui/expresskit'; // Assuming AppRoutes is exported
import {NodeKit} from '@gravity-ui/nodekit';
import {z} from 'zod/v4';

// 1. Define your Zod schemas
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

// 2. Configure the API endpoint
const CreateTaskConfig = {
  name: 'CreateTask', // Optional: for logging/tracing
  operationId: 'createTaskOperation', // Optional: for OpenAPI
  summary: 'Creates a new task', // Optional: for OpenAPI
  description: 'Detailed description of what creating a task does.', // Optional: for OpenAPI
  tags: ['Tasks'], // Optional: for OpenAPI
  request: {
    // Schemas for incoming request parts
    body: z.object({
      name: z.string().min(1), // Body must have a name
      description: z.string().optional(),
    }),
    // params: z.object({ id: z.string() }), // Example for route params
    // query: z.object({ includeAuthor: z.string() }), // Example for query params
  },
  // Define responses for different HTTP status codes
  responses: {
    201: {
      schema: TaskSchema,
      description: 'Task created successfully.',
    },
    400: {
      schema: ErrorSchema,
      description: 'Invalid input data.',
    },
    // You can add more status codes like 500, etc.
  },
} satisfies ApiRouteConfig;

// 3. Create your route handler, wrapped with withApi
const createTaskHandler = withApi(CreateTaskConfig)(async (req, res) => {
  // req.body is now automatically validated and typed according to CreateTaskConfig.request.body
  // If validation failed, a ValidationError would have been thrown, and this handler wouldn't run.
  const {name, description} = req.body;

  // Your business logic here
  const newTask = {
    id: 'task_' + Date.now(),
    name,
    description,
    createdAt: new Date().toISOString(),
    // someInternalField: 'secret' // This would be stripped by res.serialize if not in TaskSchema for status 201
  };

  // Use res.serialize() to validate and send the response according to CreateTaskConfig.responses[201]
  // If newTask doesn't match TaskSchema for status 201, a ResponseValidationError is thrown.
  res.serialize(201, newTask);
  // Or, if you were certain of the type and wanted to send a 400 error:
  // res.typedJson(400, { message: "A specific bad request reason" });
});

// 4. Integrate with your Express/ExpressKit routes:
const routes: AppRoutes = {
  'POST /tasks': createTaskHandler,
};

const nodekit = new NodeKit();
const app = new ExpressKit(nodekit, routes);

// app.run(); // Example: To run the app
```

**Key takeaways from this example:**

- Request body is automatically validated against `CreateTaskConfig.request.body`.
- If request validation fails, a `ValidationError` is thrown, and the handler is not executed (ExpressKit's error middleware typically sends a 400 response).
- Inside the handler, `req.body` is typed and contains the validated data.
- `res.serialize(statusCode, data)` validates `data` against the schema defined in `CreateTaskConfig.responses[statusCode].schema`.
- If response validation for `res.serialize` fails, a `ResponseValidationError` is thrown (ExpressKit's error middleware typically sends a 500 response).
- `res.typedJson(statusCode, data)` sends data type-checked at compile time against the schema for `statusCode`.

Now, let's dive into the details.

## Core Concepts

The primary tool is the `withApi` higher-order function, which wraps Express route handlers to add validation, serialization, and type safety based on Zod schemas.

### `withApi(config)(handler)`

- **`config` (`ApiRouteConfig`)**: An object to configure validation behavior and OpenAPI documentation.

  ```typescript
  interface ApiRouteConfig {
    name?: string; // Descriptive name for logging/tracing
    operationId?: string; // Unique ID for the operation (e.g., for OpenAPI)
    summary?: string; // Short summary for OpenAPI
    description?: string; // Detailed description for OpenAPI
    tags?: string[]; // Tags for grouping (e.g., for OpenAPI)
    manualValidation?: boolean; // Default: false. If true, call req.validate() manually.
    request?: {
      body?: z.ZodType<any>; // Schema for req.body
      params?: z.ZodType<any>; // Schema for req.params
      query?: z.ZodType<any>; // Schema for req.query
      headers?: z.ZodType<any>; // Schema for req.headers
    };
    // Define response schemas for various HTTP status codes. This field is MANDATORY.
    responses: Record<
      number,
      {
        // Changed from responses? to responses (mandatory)
        schema: z.ZodType<any>; // Zod schema for this status code's response body
        description?: string; // Description for this response (e.g., for OpenAPI)
      }
    >;
  }
  ```

  Key properties:

  - `manualValidation`: Set to `true` to disable automatic request validation.
  - `request`: Define Zod schemas for `body`, `params`, `query`, `headers`.
  - `responses`: (Mandatory) A record where keys are HTTP status codes (e.g., `200`, `201`, `400`) and values are objects containing a `schema` (Zod schema for the response body) and an optional `description`. This is used by `res.serialize()` and `res.typedJson()`, and for generating OpenAPI documentation.

- **`handler(req, res)`**: Your Express route handler, receiving enhanced `req` and `res` objects.

### Enhanced Request (`ApiRequest`)

The `req` object in your handler is enhanced:

- **Typed Properties**: `req.body`, `req.params`, `req.query`, `req.headers` are typed based on `ApiRouteConfig.request` schemas (if automatic validation is enabled and successful).
- **`req.validate(): Promise<ValidatedData>`**:
  - Call this asynchronous method if `manualValidation` is `true`.
  - Returns a promise resolving to an object with validated `body`, `params`, `query`, and `headers`.
  - Throws `ValidationError` on failure.

### Enhanced Response (`ApiResponse`)

The `res` object in your handler is enhanced with the following methods (as `ApiRouteConfig.responses` is mandatory and defines schemas for status codes):

- **`res.typedJson(statusCode, data)`**:

  - Sends a JSON response with the given `statusCode`.
  - The `data` argument is **type-checked** at compile time against the schema associated with `statusCode` in `ApiRouteConfig.responses`. This helps catch type mismatches during coding.
  - It **does not perform runtime validation** or data transformation (like stripping extra fields not defined in the schema). You are responsible for ensuring the data structure is correct if you bypass `res.serialize()`.
  - Useful if you are certain about the data's structure for a specific status code and want to skip the overhead of runtime validation/serialization.

- **`res.serialize(statusCode, data)`**:
  - Sends a JSON response with the given `statusCode`.
  - **Performs runtime validation** of `data` against the schema associated with `statusCode` in `ApiRouteConfig.responses`.
  - **Transforms data** according to that Zod schema. This includes stripping properties not defined in the schema, applying default values, or executing Zod `transform` functions if present.
  - Throws a `ResponseValidationError` if validation fails, preventing invalid data from being sent.
  - Sends the validated and potentially transformed data as a JSON response.
  - This is the **recommended method** to ensure strict adherence to the API contract and data integrity for each status code.

Since `ApiRouteConfig.responses` is mandatory, these methods are always available on the `res` object, typed according to the schemas provided for each status code.

### Error Handling

- **`ValidationError`**:
  - Thrown by automatic request validation or manual `req.validate()` if request data is invalid.
  - Typically results in a 400 Bad Request.
  - Contains `details` with the Zod error.
- **`ResponseValidationError`**:
  - Thrown by `res.serialize(statusCode, data)` if response data doesn't match the schema for the given `statusCode`.
  - Typically results in a 500 Internal Server Error.
  - Contains `details` with the Zod error.

These errors are caught by ExpressKit's default error handling middleware.

## Key Error Types

- `ValidationError`: For invalid request data.
- `ResponseValidationError`: For invalid response data during `res.serialize()`.
