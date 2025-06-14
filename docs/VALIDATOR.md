# ExpressKit Validator

Provides request validation (body, params, query, headers) and response serialization using Zod schemas.

## Quick Start: Automatic Validation

Here's a common example of using `withApi` for automatic request validation and response serialization:

```typescript
import { z } from 'zod/v4';
import { withApi } from '@gravity-ui/expresskit';

// 1. Define your Zod schemas
const TaskSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
});

// 2. Configure the API endpoint
const CreateTaskConfig = {
    name: 'CreateTask', // Optional: for logging/tracing
    request: { // Schemas for incoming request parts
        body: z.object({
            name: z.string().min(1), // Body must have a name
            description: z.string().optional(),
        }),
        // params: z.object({ id: z.string() }), // Example for route params
        // query: z.object({ includeAuthor: z.string() }), // Example for query params
    },
    response: TaskSchema, // Schema for the response (used by res.serialize)
};

// 3. Create your route handler, wrapped with withApi
const createTaskHandler = withApi(CreateTaskConfig)(async (req, res) => {
    // req.body is now automatically validated and typed according to CreateTaskConfig.request.body
    // If validation failed, a ValidationError would have been thrown, and this handler wouldn't run.
    const { name, description } = req.body;

    // Your business logic here
    const newTask = {
        id: 'task_' + Date.now(),
        name,
        description,
        someInternalField: 'secret' // This would be stripped by res.serialize if not in TaskSchema
    };

    // Use res.serialize() to validate and send the response according to CreateTaskConfig.response
    // If newTask doesn't match TaskSchema, a ResponseValidationError is thrown.
    res.status(201).serialize(newTask);
});

// 4. Integrate with your Express/ExpressKit routes
// Example (actual integration depends on your ExpressKit setup):
// const routes: AppRoutes = {
//     'POST /tasks': createTaskHandler,
// };
```

**Key takeaways from this example:**
- Request body is automatically validated against `CreateTaskConfig.request.body`.
- If request validation fails, a `ValidationError` is thrown, and the handler is not executed (ExpressKit's error middleware typically sends a 400 response).
- Inside the handler, `req.body` is typed and contains the validated data.
- `res.serialize(newTask)` validates `newTask` against `CreateTaskConfig.response`.
- If response validation fails, a `ResponseValidationError` is thrown (ExpressKit's error middleware typically sends a 500 response).

Now, let's dive into the details.

## Core Concepts

The primary tool is the `withApi` higher-order function, which wraps Express route handlers to add validation and serialization.

### `withApi(config)(handler)`

-   **`config` (`ApiRouteConfig`)**: An object to configure validation behavior.
    ```typescript
    interface ApiRouteConfig {
        name?: string;            // Descriptive name for logging/documentation
        tags?: string[];          // Tags for grouping (e.g., Swagger)
        manualValidation?: boolean; // Default: false. If true, call req.validate() manually.
        request?: {
            body?: z.ZodType<any>;    // Schema for req.body
            params?: z.ZodType<any>;   // Schema for req.params
            query?: z.ZodType<any>;    // Schema for req.query
            headers?: z.ZodType<any>;  // Schema for req.headers
        };
        response?: z.ZodType<any>; // Schema for response body (used by res.serialize)
    }
    ```
    Key properties:
    *   `manualValidation`: Set to `true` to disable automatic request validation.
    *   `request`: Define Zod schemas for `body`, `params`, `query`, `headers`.
    *   `response`: Define a Zod schema for the response, used by `res.serialize()`.

-   **`handler(req, res)`**: Your Express route handler, receiving enhanced `req` and `res` objects.

### Enhanced Request (`ApiRequest`)

The `req` object in your handler is enhanced:
*   **Typed Properties**: `req.body`, `req.params`, `req.query`, `req.headers` are typed based on `ApiRouteConfig.request` schemas (if automatic validation is enabled and successful).
*   **`req.validate(): Promise<ValidatedData>`**:
    *   Call this asynchronous method if `manualValidation` is `true`.
    *   Returns a promise resolving to an object with validated `body`, `params`, `query`, and `headers`.
    *   Throws `ValidationError` on failure.

### Enhanced Response (`ApiResponse`)

The `res` object in your handler is enhanced with the following methods when a `response` schema is defined in `ApiRouteConfig`:

*   **`res.typedJson(data)`**:
    *   Sends a JSON response.
    *   The `data` argument is **type-checked** at development time against the `ApiRouteConfig.response` schema. This helps catch type mismatches during coding.
    *   It **does not perform runtime validation** or data transformation (like stripping extra fields not defined in the schema). You are responsible for ensuring the data structure is correct if you bypass `res.serialize()`.
    *   Useful if you are certain about the data's structure and want to skip the overhead of runtime validation/serialization.

*   **`res.serialize(data)`**:
    *   **Performs runtime validation** of `data` against the `ApiRouteConfig.response` schema.
    *   **Transforms data** according to the Zod schema. This includes stripping properties not defined in the schema, applying default values, or executing Zod `transform` functions if present.
    *   Throws a `ResponseValidationError` if validation fails, preventing invalid data from being sent.
    *   Sends the validated and potentially transformed data as a JSON response.
    *   This is the **recommended method** when a `response` schema is defined in `ApiRouteConfig` to ensure strict adherence to the API contract and data integrity.

If no `response` schema is provided in `ApiRouteConfig`, these methods will not be available.

### Error Handling

-   **`ValidationError`**:
    *   Thrown by automatic request validation or manual `req.validate()` if request data is invalid.
    *   Typically results in a 400 Bad Request.
    *   Contains `details` with the Zod error.
-   **`ResponseValidationError`**:
    *   Thrown by `res.serialize()` if response data doesn't match the `response` schema.
    *   Typically results in a 500 Internal Server Error.
    *   Contains `details` with the Zod error.

These errors are caught by ExpressKit's default error handling middleware.

## Key Error Types

-   `ValidationError`: For invalid request data.
-   `ResponseValidationError`: For invalid response data during `res.serialize()`.
