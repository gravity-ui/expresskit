import request from 'supertest';
import {z} from 'zod/v4';
import {ExpressKit, RouteContract, withContract} from '..';
import {NodeKit} from '@gravity-ui/nodekit';
import type {Application as ExpressApplication} from 'express';

const ErrorSchema = z.object({
    error: z.string(),
    code: z.string().optional(),
    issues: z
        .array(z.object({message: z.string(), path: z.array(z.string().or(z.number()))}))
        .optional(),
});

const SuccessResponseBodySchema = z.object({
    id: z.string(),
    name: z.string(),
    value: z.number(),
});

const AsyncResponseBodySchema = z.object({
    timestamp: z.string(),
});

const validateSuccessRouteContract = {
    name: 'ValidateSuccessAPI',
    request: {
        body: z.object({
            name: z.string(),
            value: z.number(),
        }),
    },
    response: {
        content: {
            201: {schema: SuccessResponseBodySchema, description: 'Successfully created.'},
            400: {schema: ErrorSchema, description: 'Invalid request body.'},
        },
    },
} satisfies RouteContract;
const validateSuccessController = withContract(validateSuccessRouteContract)(async (req, res) => {
    const {body: data} = await req.validate();
    const result = {
        id: '123',
        name: data.name,
        value: data.value,
    };
    res.sendTyped(201, result);
});

const rejectInvalidRouteContract = {
    name: 'RejectInvalidAPI',
    request: {
        body: z.object({
            name: z.string(),
            value: z.number(),
        }),
    },
    response: {
        content: {
            // Must define expected responses, even if error is primary test
            200: {
                schema: z.object({name: z.string(), value: z.number()}),
                description: 'Successful response (not expected in this test).',
            },
            400: {schema: ErrorSchema, description: 'Invalid request body.'},
        },
    },
} satisfies RouteContract;
const rejectInvalidController = withContract(rejectInvalidRouteContract)(async (req, res) => {
    const {body: data} = await req.validate(); // This should throw for invalid data
    res.status(200).json(data); // Should not be reached if validation fails
});

const asyncOperationRouteContract = {
    name: 'AsyncOperationAPI',
    response: {
        content: {
            200: {schema: AsyncResponseBodySchema, description: 'Successful async response.'},
            500: {schema: ErrorSchema, description: 'Internal server error.'},
        },
    },
} satisfies RouteContract;
const asyncOperationController = withContract(asyncOperationRouteContract)(async (_req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    res.sendTyped(200, {
        timestamp: new Date().toISOString(),
    });
});

const ManualValidationBodySchema = z.object({
    itemId: z.string(),
    quantity: z.number().min(1),
});
const ManualValidationRouteContract = {
    name: 'ManualValidationAPI',
    manualValidation: true, // Key for this test
    request: {
        body: ManualValidationBodySchema,
    },
    response: {
        content: {
            200: {schema: ManualValidationBodySchema, description: 'Manual validation successful.'},
            400: {schema: ErrorSchema, description: 'Invalid input for manual validation.'},
        },
    },
} satisfies RouteContract;
const manualValidationController = withContract(ManualValidationRouteContract)(async (req, res) => {
    // Manually trigger validation.
    // If validation fails, withApi middleware is expected to catch the ZodError
    // and automatically send a 400 response.
    // If successful, req.validate() returns the validated data parts (body, params, query, headers).
    const {body: validatedData} = await req.validate();

    // Access validated data and send response
    res.sendTyped(200, validatedData);
});

const TypedJsonTestSchema = z
    .object({
        // Schema for response
        id: z.number(),
        name: z.string(),
    })
    .loose(); // Use .loose() to allow extra fields without erroring/stripping

const TypedJsonRouteContract = {
    name: 'TypedJsonAPI',
    response: {
        content: {
            200: {schema: TypedJsonTestSchema, description: 'TypedJSON test successful.'},
        },
    },
} satisfies RouteContract;
const typedJsonController = withContract(TypedJsonRouteContract)(async (_req, res) => {
    const dataWithExtraField = {
        id: 1,
        name: 'Test Item',
        extraField: 'this should not be stripped by typedJson',
        anotherExtra: 123,
    };
    // typedJson should perform type checking based on schema but not strip extra fields
    res.sendTyped(200, dataWithExtraField);
});

const SerializeTestSchema = z.object({
    id: z.number(),
    name: z.string(),
});

const SerializeRouteContract = {
    name: 'SerializeAPI',
    response: {
        content: {
            200: {schema: SerializeTestSchema, description: 'Serialize test successful.'},
        },
    },
} satisfies RouteContract;

const serializeController = withContract(SerializeRouteContract)(async (_req, res) => {
    const dataWithExtraField = {
        id: 1,
        name: 'Test Item',
        extraField: 'this should be stripped by serialize',
        anotherExtra: 456,
    };
    // serialize should strip extra fields according to the schema
    res.sendValidated(200, dataWithExtraField);
});

const NestedObjectSchema = z.object({
    key: z.string(),
    value: z.string(),
});

const NestedArrayItemSchema = z.object({
    itemId: z.string(),
    count: z.number(),
});

const SerializeNestedTestSchema = z.object({
    orderId: z.string(),
    customer: z.object({
        customerId: z.string(),
        customerName: z.string(),
    }),
    items: z.array(NestedArrayItemSchema),
    metadata: NestedObjectSchema,
});

const SerializeNestedRouteContract = {
    name: 'SerializeNestedAPI',
    response: {
        content: {
            200: {
                schema: SerializeNestedTestSchema,
                description: 'Serialize nested test successful.',
            },
        },
    },
} satisfies RouteContract;

const serializeNestedController = withContract(SerializeNestedRouteContract)(async (_req, res) => {
    const dataWithExtraFieldsNested = {
        orderId: 'order-123',
        extraOrderField: 'should be stripped',
        customer: {
            customerId: 'cust-abc',
            customerName: 'John Doe',
            customerEmail: 'john.doe@example.com', // extra
        },
        items: [
            {
                itemId: 'item-001',
                count: 2,
                itemDescription: 'extra description', // extra
            },
            {
                itemId: 'item-002',
                count: 1,
            },
        ],
        metadata: {
            key: 'source',
            value: 'web',
            timestamp: Date.now(), // extra
        },
        globalExtra: 'completely irrelevant',
    };
    res.sendValidated(200, dataWithExtraFieldsNested);
});

const ComprehensiveValidationSchema = z.object({
    userId: z.string().uuid(),
    source: z.string(),
    apiVersion: z.string(),
    traceId: z.string().uuid(),
});

const ComprehensiveValidationRouteContract = {
    name: 'ComprehensiveValidationAPI',
    request: {
        params: z.object({
            userId: z.string().uuid({message: 'Invalid User ID in path'}),
        }),
        query: z.object({
            source: z.string().min(1, {message: 'Source query parameter is required'}),
        }),
        headers: z.object({
            'x-api-version': z.string().regex(/^v[0-9]+$/, {
                message: 'X-API-Version header must be in format v1, v2, etc.',
            }),
            'x-trace-id': z.string().uuid({message: 'X-Trace-ID header must be a valid UUID'}),
        }),
    },
    response: {
        content: {
            200: {
                schema: ComprehensiveValidationSchema,
                description: 'Comprehensive validation successful.',
            },
            400: {schema: ErrorSchema, description: 'Invalid input for params, query, or headers.'},
        },
    },
} satisfies RouteContract;

const comprehensiveValidationController = withContract(ComprehensiveValidationRouteContract)(async (
    req,
    res,
) => {
    const {userId} = req.params;
    const {source} = req.query;
    const apiVersion = req.headers['x-api-version'];
    const traceId = req.headers['x-trace-id'];

    res.sendTyped(200, {
        userId,
        source,
        apiVersion,
        traceId,
    });
});

describe('withApi', () => {
    let app: ExpressApplication;
    let nodekit: NodeKit;

    beforeEach(() => {
        nodekit = new NodeKit({
            config: {
                appName: 'test-app-withapi',
                appLoggingDestination: {
                    write: () => {},
                },
            },
        });

        const routes = {
            'POST /test-validate-success': {handler: validateSuccessController},
            'POST /test-reject-invalid': {handler: rejectInvalidController},
            'GET /test-async': {handler: asyncOperationController},
            'GET /comprehensive-check/:userId': {handler: comprehensiveValidationController},
            'POST /manual-validation': {handler: manualValidationController},
            'POST /manual-validation-fail': {handler: manualValidationController},
            'GET /typed-json-test': {handler: typedJsonController},
            'GET /serialize-test': {handler: serializeController},
            'GET /serialize-nested-test': {handler: serializeNestedController},
            'POST /error-structure-test': {handler: rejectInvalidController},
            'POST /custom-content-type': {
                handler: withContract({
                    request: {
                        contentType: ['application/x-www-form-urlencoded'],
                        body: z.object({name: z.string()}),
                    },
                    response: {
                        content: {
                            200: {
                                schema: z.object({name: z.string()}),
                            },
                        },
                    },
                })(async (req, res) => {
                    res.sendValidated(200, req.body);
                }),
            },
        };

        const expressKit = new ExpressKit(nodekit, routes);
        app = expressKit.express;
    });

    it('should validate request body and serialize response', async () => {
        const response = await request(app)
            .post('/test-validate-success')
            .send({name: 'test', value: 42})
            .expect(201);

        expect(response.body).toEqual({
            id: '123',
            name: 'test',
            value: 42,
        });
    });

    it('should reject invalid request body', async () => {
        await request(app)
            .post('/test-reject-invalid')
            .send({name: 'test', value: 'not a number'})
            .expect(400);
    });

    it('should support async operations', async () => {
        const response = await request(app).get('/test-async').expect(200);

        expect(response.body).toHaveProperty('timestamp');
    });

    describe('Comprehensive Params, Query, and Headers Validation', () => {
        const validUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
        const validTraceId = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

        it('should succeed with valid params, query, and headers', async () => {
            const response = await request(app)
                .get(`/comprehensive-check/${validUserId}?source=web`)
                .set('X-API-Version', 'v1')
                .set('X-Trace-ID', validTraceId)
                .expect(200);

            expect(response.body).toEqual({
                userId: validUserId,
                source: 'web',
                apiVersion: 'v1',
                traceId: validTraceId,
            });
        });

        it('should fail with invalid userId in params (not a UUID)', async () => {
            await request(app)
                .get('/comprehensive-check/invalid-user-id?source=web')
                .set('X-API-Version', 'v1')
                .set('X-Trace-ID', validTraceId)
                .expect(400);
        });

        it('should fail with missing source in query', async () => {
            await request(app)
                .get(`/comprehensive-check/${validUserId}`)
                .set('X-API-Version', 'v1')
                .set('X-Trace-ID', validTraceId)
                .expect(400);
        });

        it('should fail with invalid X-API-Version header format', async () => {
            await request(app)
                .get(`/comprehensive-check/${validUserId}?source=web`)
                .set('X-API-Version', 'invalid-version')
                .set('X-Trace-ID', validTraceId)
                .expect(400);
        });

        it('should fail with invalid X-Trace-ID header (not a UUID)', async () => {
            await request(app)
                .get(`/comprehensive-check/${validUserId}?source=web`)
                .set('X-API-Version', 'v1')
                .set('X-Trace-ID', 'invalid-trace-id')
                .expect(400);
        });

        it('should fail with missing X-API-Version header', async () => {
            await request(app)
                .get(`/comprehensive-check/${validUserId}?source=web`)
                .set('X-Trace-ID', validTraceId)
                // X-API-Version is omitted
                .expect(400);
        });
    });

    describe('Manual Validation', () => {
        it('should allow manual validation and succeed with valid data', async () => {
            const response = await request(app)
                .post('/manual-validation')
                .send({itemId: 'item-456', quantity: 5})
                .expect(200);
            expect(response.body).toEqual({itemId: 'item-456', quantity: 5});
        });

        it('should fail manual validation with invalid data and return 400', async () => {
            const response = await request(app).post('/manual-validation-fail').send({quantity: 0}); // Invalid: quantity must be >= 1

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid request data');
            expect(response.body.issues).toBeInstanceOf(Array);
            // Check for the presence of the specific error message, regardless of order
            expect(response.body.issues).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({message: 'Too small: expected number to be >=1'}),
                ]),
            );
        });
    });
    describe('res.typedJson', () => {
        it('should type-check but NOT strip extra fields from response body', async () => {
            const response = await request(app).get('/typed-json-test').expect(200);

            // It should return the object AS IS, including extra fields,
            // if the original object matches the schema for defined fields.
            // The previous lint error suggests typedJson might be stricter than just type checking
            // and could be flagging extra fields. This test will clarify its behavior.
            expect(response.body).toEqual({
                id: 1,
                name: 'Test Item',
                extraField: 'this should not be stripped by typedJson',
                anotherExtra: 123,
            });
        });
    });

    describe('res.serialize', () => {
        it('should strip extra fields from response body based on schema', async () => {
            const response = await request(app).get('/serialize-test').expect(200);
            expect(response.body).toEqual({
                id: 1,
                name: 'Test Item',
            });
        });

        it('should strip extra fields from nested objects and arrays', async () => {
            const response = await request(app).get('/serialize-nested-test').expect(200);
            expect(response.body).toEqual({
                orderId: 'order-123',
                customer: {
                    customerId: 'cust-abc',
                    customerName: 'John Doe',
                },
                items: [
                    {
                        itemId: 'item-001',
                        count: 2,
                    },
                    {
                        itemId: 'item-002',
                        count: 1,
                    },
                ],
                metadata: {
                    key: 'source',
                    value: 'web',
                },
            });
        });
    });

    describe('Error Response Structure', () => {
        it('should include a details property with issues for validation errors', async () => {
            const response = await request(app).post('/error-structure-test').send({value: 'abc'}); // Invalid: value should be a number

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Invalid request data');
            expect(response.body).toHaveProperty('issues');
            expect(response.body.issues).toBeInstanceOf(Array);
            expect(response.body.issues.length).toBeGreaterThan(0);
            // Check for the presence of the specific error path, regardless of order
            expect(response.body.issues).toEqual(
                expect.arrayContaining([expect.objectContaining({path: ['body', 'value']})]),
            );
        });
    });

    describe('Custom Content-Type Handling', () => {
        it('should allow custom content-type', async () => {
            const response = await request(app)
                .post('/custom-content-type')
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .send('name=test');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({name: 'test'});
        });

        it('should reject unsupported content-type', async () => {
            const response = await request(app)
                .post('/custom-content-type')
                .set('Content-Type', 'application/json')
                .send({name: 'test'});

            expect(response.status).toBe(400);
            expect(response.body.error).toBe(
                'Unsupported content-type. Allowed: application/x-www-form-urlencoded',
            );
        });
    });
});
