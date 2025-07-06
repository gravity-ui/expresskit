/* eslint-disable no-console */
import {z} from 'zod/v4';
import {AppRoutes, RouteContract, withContract} from '../index'; // Adjust path based on actual export structure
import {ExpressKit} from '../expresskit'; // Adjust path
import {NodeKit} from '@gravity-ui/nodekit'; // Assuming this is a peer dependency or similar
import crypto from 'crypto';

// --- Basic Schemas ---
const UserSchema = z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
});

const ItemSchema = z.object({
    itemId: z.string().uuid(),
    itemName: z.string(),
    quantity: z.number().positive(),
});

const SuccessMessageSchema = z.object({
    message: z.string(),
    details: z.string().optional(),
});

const ErrorSchema = z.object({
    error: z.string(),
    code: z.string().optional(),
    issues: z
        .array(z.object({message: z.string(), path: z.array(z.string().or(z.number()))}))
        .optional(),
});

const ItemDetailSchema = z.object({
    property: z.string(),
    value: z.string(),
});

const ExtendedItemSchema = ItemSchema.extend({
    description: z.string().optional(),
    details: z.array(ItemDetailSchema),
    relatedItemIds: z.array(z.uuid()).optional(),
});

// --- Example 1: GET User by ID ---
const GetUserConfig = {
    operationId: 'getUserById',
    summary: 'Get a user by their ID',
    tags: ['Users'],
    request: {
        params: z.object({userId: z.uuid({message: 'Invalid user ID format'})}),
    },
    response: {
        content: {
            200: {
                schema: UserSchema,
                description: 'User found successfully.',
            },
            404: {
                schema: ErrorSchema,
                description: 'User not found.',
            },
            400: {
                // For invalid UUID by Zod
                schema: ErrorSchema,
                description: 'Invalid request parameters.',
            },
        },
    },
} satisfies RouteContract;

const getUserHandler = withContract(GetUserConfig)(async (req, res) => {
    const {userId} = req.params; // Typed and validated

    // Simulate database lookup
    if (userId === '00000000-0000-0000-0000-000000000000') {
        res.sendValidated(404, {error: 'User not found', code: 'USER_NOT_FOUND'});
    } else {
        const user = {
            id: userId,
            name: 'John Doe',
            email: 'john.doe@example.com',
            internalOnly: 'secret', // This would be stripped by serialize
        };
        res.sendValidated(200, user);
    }
});

// --- Example 2: Create Item ---
const CreateItemConfig = {
    operationId: 'createItem',
    summary: 'Create a new item',
    tags: ['Items'],
    request: {
        body: z.object({
            itemName: z.string().min(3, 'Item name must be at least 3 characters long'),
            quantity: z.number().int().positive('Quantity must be a positive integer'),
        }),
    },
    response: {
        content: {
            201: {
                schema: ItemSchema,
                description: 'Item created successfully.',
            },
            400: {
                schema: ErrorSchema,
                description: 'Invalid item data provided.',
            },
            422: {
                // Example for a business logic validation error
                schema: ErrorSchema,
                description: 'Item could not be processed due to business rules.',
            },
        },
    },
} satisfies RouteContract;

const createItemHandler = withContract(CreateItemConfig)(async (req, res) => {
    const {itemName, quantity} = req.body; // Typed and validated

    // Simulate business logic
    if (itemName === 'forbidden_item') {
        res.sendTyped(422, {error: 'This item name is not allowed.', code: 'ITEM_FORBIDDEN'});
        return;
    }

    const newItem = {
        itemId: `item_${Date.now()}`, // wrong contract for example purposes, will cause serialization error
        itemName,
        quantity,
    };
    res.sendValidated(201, newItem);
});

// --- Example 3: Update User Email (Manual Validation Example) ---
const UpdateUserEmailConfig = {
    operationId: 'updateUserEmail',
    summary: "Update a user's email address",
    tags: ['Users'],
    manualValidation: true, // Enable manual validation
    request: {
        params: z.object({userId: z.uuid()}),
        body: z
            .object({
                email: z.email('Invalid email format'),
                confirmEmail: z.email('Invalid confirmation email format'),
            })
            .refine((data) => data.email === data.confirmEmail, {
                message: 'Emails do not match',
                path: ['confirmEmail'], // Path of the error
            }),
    },
    response: {
        content: {
            200: {
                schema: SuccessMessageSchema,
                description: 'Email updated successfully.',
            },
            400: {
                schema: ErrorSchema,
                description: 'Validation failed or emails did not match.',
            },
        },
    },
} satisfies RouteContract;

const updateUserEmailHandler = withContract(UpdateUserEmailConfig)(async (req, res) => {
    // Manually trigger validation
    const {params, body} = await req.validate();
    // params.userId and body.email are now validated and typed

    res.sendTyped(200, {
        message: 'Email updated successfully',
        details: `User ${params.userId} email changed to ${body.email}`,
    });
});

// --- Example 4: No Response Body (204 No Content) ---
const DeleteItemConfig = {
    operationId: 'deleteItem',
    summary: 'Delete an item by ID',
    tags: ['Items'],
    request: {
        params: z.object({itemId: z.uuid()}),
    },
    response: {
        content: {
            204: {
                // For 204 No Content, often no schema is needed, or an empty schema.
                // Zod doesn't have a direct equivalent for an empty schema that translates well to OpenAPI without content.
                // The OpenAPI generator should ideally omit the content field for 204 if the schema is z.undefined() or z.void().
                // Using z.undefined() to signify no actual data/body.
                schema: z.undefined(),
                description: 'Item deleted successfully, no content returned.',
            },
            404: {
                schema: ErrorSchema,
                description: 'Item not found.',
            },
        },
    },
} satisfies RouteContract;

const deleteItemHandler = withContract(DeleteItemConfig)(async (req, res) => {
    const {itemId} = req.params;
    // Simulate deletion
    console.log(`Deleting item ${itemId}`);
    // For 204, you typically don't send a body.
    // res.status(204).send(); or res.status(204).end(); are common.
    // Using typedJson with an empty object or undefined if schema allows.
    // If schema is z.undefined(), sending undefined is correct.
    res.sendTyped(204, undefined);
});

// --- Example 5: GET Items (List of Nested Objects) ---
const GetItemsConfig = {
    operationId: 'getItems',
    summary: 'Get a list of items with nested details',
    tags: ['Items'],
    request: {
        query: z.object({
            limit: z.coerce.number().min(1).max(10).default(10),
            includeDetails: z.stringbool().optional().default(false),
        }),
    },
    response: {
        content: {
            200: {
                schema: z.array(ExtendedItemSchema),
                description: 'A list of items retrieved successfully.',
            },
            400: {
                schema: ErrorSchema,
                description: 'Invalid query parameters.',
            },
        },
    },
} satisfies RouteContract;

const getItemsHandler = withContract(GetItemsConfig)(async (req, res) => {
    const {limit} = req.query; // Typed and validated

    const includeDetails = true;
    const itemsData = Array.from({length: Math.min(limit || 10, 5)}, (_, i) => ({
        // Limit to 5 for example
        itemId: crypto.randomUUID(),
        itemName: `Item ${i + 1}`,
        quantity: (i + 1) * 2,
        description: includeDetails ? `This is detailed description for item ${i + 1}.` : undefined,
        details: includeDetails
            ? [
                  {property: 'Color', value: i % 2 === 0 ? 'Red' : 'Blue'},
                  {property: 'Material', value: 'Recycled'},
              ]
            : [],
        relatedItemIds: i % 2 === 0 ? [crypto.randomUUID(), crypto.randomUUID()] : [],
        // Extra field to demonstrate stripping by serialize
        internalNotes: 'This note is for internal use only and should be stripped.',
    }));

    res.sendValidated(200, itemsData);
});

// --- Setup ExpressKit Application (Illustrative) ---
export const exampleRoutes: AppRoutes = {
    'GET /users/:userId': getUserHandler,
    'POST /items': createItemHandler,
    'PUT /users/:userId/email': updateUserEmailHandler,
    'DELETE /items/:itemId': deleteItemHandler,
    'GET /items': getItemsHandler, // Added new route
};

// To run this example (you'd typically have this in your main app file):

const nodekit = new NodeKit({
    config: {
        openApiRegistry: {
            enabled: true,
            version: '3.0.0',
            title: 'Example API',
            description: 'An example API to demonstrate Zod validation and ExpressKit integration.',
            servers: [{url: 'http://localhost:3030', description: 'Local server'}],
        },
    },
});

const app = new ExpressKit(nodekit, exampleRoutes);

app.run();

console.log(`Example server running on port`);
console.log('Try:');
console.log('  GET /users/123e4567-e89b-12d3-a456-426614174000');
console.log('  GET /users/00000000-0000-0000-0000-000000000000 (for 404)');
console.log('  POST /items with JSON body { "itemName": "My New Item", "quantity": 10 }');
console.log('  POST /items with JSON body { "itemName": "forbidden_item", "quantity": 1 }');
console.log(
    '  PUT /users/123e4567-e89b-12d3-a456-426614174000/email with JSON body { "email": "new@example.com", "confirmEmail": "new@example.com" }',
);
console.log(
    '  PUT /users/123e4567-e89b-12d3-a456-426614174000/email with JSON body { "email": "new@example.com", "confirmEmail": "other@example.com" }',
);
console.log('  DELETE /items/123e4567-e89b-12d3-a456-426614174000');
console.log('  GET /items');
console.log('  GET /items?limit=3&includeDetails=false');
