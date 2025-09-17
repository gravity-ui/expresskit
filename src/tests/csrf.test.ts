import {AuthPolicy, ExpressKit, Request, Response} from '..';
import {NodeKit, USER_ID_PARAM_NAME} from '@gravity-ui/nodekit';
import request from 'supertest';
import {CSRF_TOKEN_CONTEXT_KEY} from '../constants';

const mockAuthMiddleware = (userId: string) => (req: Request, _res: Response, next: () => void) => {
    req.originalContext.set(USER_ID_PARAM_NAME, userId);
    next();
};

const setupApp = (csrfConfig: NodeKit['config'] = {}, userId = 'test-user-123') => {
    const nodekit = new NodeKit({
        config: {
            appCsrfSecret: 'test-secret-key',
            appCsrfMethods: ['POST', 'PUT', 'DELETE', 'PATCH'],
            appCsrfHeaderName: 'x-csrf-token',
            appCsrfLifetime: 3600, // 1 hour
            appAuthPolicy: AuthPolicy.required,
            appAuthHandler: mockAuthMiddleware(userId),
            ...csrfConfig,
        },
    });

    const routes = {
        'GET /csrf-token': {
            authPolicy: AuthPolicy.required,
            handler: (req: Request, res: Response) => {
                res.status(200).json({
                    csrfToken: req.originalContext.get(CSRF_TOKEN_CONTEXT_KEY),
                    userId: req.ctx.get(USER_ID_PARAM_NAME),
                });
            },
        },
        'POST /test-csrf': {
            authPolicy: AuthPolicy.required,
            handler: (_req: Request, res: Response) => {
                res.status(200).json({message: 'CSRF validation passed'});
            },
        },
        'PUT /test-csrf': {
            authPolicy: AuthPolicy.required,
            handler: (_req: Request, res: Response) => {
                res.status(200).json({message: 'CSRF validation passed'});
            },
        },
        'DELETE /test-csrf': {
            authPolicy: AuthPolicy.required,
            handler: (_req: Request, res: Response) => {
                res.status(200).json({message: 'CSRF validation passed'});
            },
        },
        'PATCH /test-csrf': {
            authPolicy: AuthPolicy.required,
            handler: (_req: Request, res: Response) => {
                res.status(200).json({message: 'CSRF validation passed'});
            },
        },
        'GET /test-csrf': {
            authPolicy: AuthPolicy.required,
            handler: (_req: Request, res: Response) => {
                res.status(200).json({message: 'GET request - no CSRF required'});
            },
        },
        'POST /csrf-disabled': {
            authPolicy: AuthPolicy.required,
            disableCsrf: true,
            handler: (_req: Request, res: Response) => {
                res.status(200).json({message: 'CSRF disabled for this route'});
            },
        },
    };

    const app = new ExpressKit(nodekit, routes);
    return app;
};

describe('CSRF Middleware', () => {
    describe('Token Generation', () => {
        it('should generate CSRF token and set it in response locals', async () => {
            const app = setupApp();
            const res = await request.agent(app.express).get('/csrf-token');

            expect(res.status).toBe(200);
            expect(res.body.csrfToken).toBeDefined();
            expect(res.body.userId).toBe('test-user-123');
            expect(res.body.csrfToken).toMatch(/^[a-f0-9]+:\d+$/);
        });

        it('should set CSRF token in designated header', async () => {
            const app = setupApp();
            const res = await request.agent(app.express).get('/csrf-token');

            // Verify the token content matches what's in the response body
            expect(res.headers['x-csrf-token']).toBe(res.body.csrfToken);
        });

        it('should generate different tokens for different users', async () => {
            const app1 = setupApp({}, 'user1');
            const app2 = setupApp({}, 'user2');

            const res1 = await request.agent(app1.express).get('/csrf-token');
            const res2 = await request.agent(app2.express).get('/csrf-token');

            expect(res1.body.csrfToken).not.toBe(res2.body.csrfToken);
        });
    });

    describe('Token Validation', () => {
        it('should accept valid CSRF token in header', async () => {
            const app = setupApp();

            // First get a valid token
            const tokenRes = await request.agent(app.express).get('/csrf-token');
            const validToken = tokenRes.body.csrfToken;

            // Use the token in a POST request
            const res = await request
                .agent(app.express)
                .post('/test-csrf')
                .set('x-csrf-token', validToken);

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('CSRF validation passed');
        });

        it('should reject missing CSRF token', async () => {
            const app = setupApp();

            const res = await request.agent(app.express).post('/test-csrf');

            expect(res.status).toBe(419);
        });

        it('should reject invalid CSRF token', async () => {
            const app = setupApp();

            const res = await request
                .agent(app.express)
                .post('/test-csrf')
                .set('x-csrf-token', 'invalid-token');

            expect(res.status).toBe(419);
        });

        it('should reject CSRF token for different user', async () => {
            const app1 = setupApp({}, 'user1');
            const app2 = setupApp({}, 'user2');

            // Get token for user1
            const tokenRes = await request.agent(app1.express).get('/csrf-token');
            const user1Token = tokenRes.body.csrfToken;

            // Try to use user1's token with user2's session
            const res = await request
                .agent(app2.express)
                .post('/test-csrf')
                .set('x-csrf-token', user1Token);

            expect(res.status).toBe(419);
        });
    });

    describe('HTTP Methods', () => {
        it('should require CSRF token for POST requests', async () => {
            const app = setupApp();

            const res = await request.agent(app.express).post('/test-csrf');
            expect(res.status).toBe(419);
        });

        it('should require CSRF token for PUT requests', async () => {
            const app = setupApp();

            const res = await request.agent(app.express).put('/test-csrf');
            expect(res.status).toBe(419);
        });

        it('should require CSRF token for DELETE requests', async () => {
            const app = setupApp();

            const res = await request.agent(app.express).delete('/test-csrf');
            expect(res.status).toBe(419);
        });

        it('should require CSRF token for PATCH requests', async () => {
            const app = setupApp();

            const res = await request.agent(app.express).patch('/test-csrf');
            expect(res.status).toBe(419);
        });

        it('should not require CSRF token for GET requests', async () => {
            const app = setupApp();

            const res = await request.agent(app.express).get('/test-csrf');
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('GET request - no CSRF required');
        });
    });

    describe('Token Expiration', () => {
        it('should reject expired CSRF token', async () => {
            const app = setupApp({appCsrfLifetime: 1}); // 1 second lifetime

            // Get a token
            const tokenRes = await request.agent(app.express).get('/csrf-token');
            const token = tokenRes.body.csrfToken;

            // Wait for token to expire
            await new Promise((resolve) => setTimeout(resolve, 1100));

            const res = await request
                .agent(app.express)
                .post('/test-csrf')
                .set('x-csrf-token', token);

            expect(res.status).toBe(419); // 419 Authentication Timeout is the standard CSRF error code
        });

        it('should accept non-expired CSRF token', async () => {
            const app = setupApp({appCsrfLifetime: 10}); // 10 seconds lifetime

            const tokenRes = await request.agent(app.express).get('/csrf-token');
            const token = tokenRes.body.csrfToken;

            const res = await request
                .agent(app.express)
                .post('/test-csrf')
                .set('x-csrf-token', token);

            expect(res.status).toBe(200);
        });
    });

    describe('CSRF Disabled Routes', () => {
        it('should not require CSRF token for routes with disableCsrf flag', async () => {
            const app = setupApp();

            const res = await request.agent(app.express).post('/csrf-disabled');
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('CSRF disabled for this route');
        });
    });

    describe('Configuration', () => {
        it('should work with custom CSRF token header name', async () => {
            const app = setupApp({appCsrfHeaderName: 'x-custom-csrf'});

            const tokenRes = await request.agent(app.express).get('/csrf-token');
            const validToken = tokenRes.body.csrfToken;

            const res = await request
                .agent(app.express)
                .post('/test-csrf')
                .set('x-custom-csrf', validToken);

            expect(res.status).toBe(200);
        });

        it('should work with custom CSRF header name', async () => {
            const app = setupApp({appCsrfHeaderName: 'x-custom-csrf'});

            const res = await request.agent(app.express).get('/csrf-token');

            expect(res.headers['x-custom-csrf']).toBeDefined();
            expect(res.headers['x-custom-csrf']).toMatch(/^[a-f0-9]+:\d+$/);

            // Verify the token content matches what's in the response body
            expect(res.headers['x-custom-csrf']).toBe(res.body.csrfToken);

            // Ensure the default header is not set
            expect(res.headers['x-csrf-token']).toBeUndefined();
        });

        it('should work with custom HTTP methods', async () => {
            const app = setupApp({appCsrfMethods: ['POST', 'GET']});

            // GET should now require CSRF
            const res = await request.agent(app.express).get('/test-csrf');
            expect(res.status).toBe(419);
        });

        it('should work with multiple CSRF secrets', async () => {
            const app = setupApp({
                appCsrfSecret: ['secret1', 'secret2'],
            });

            const tokenRes = await request.agent(app.express).get('/csrf-token');
            const validToken = tokenRes.body.csrfToken;

            const res = await request
                .agent(app.express)
                .post('/test-csrf')
                .set('x-csrf-token', validToken);

            expect(res.status).toBe(200);
        });

        it('should validate tokens generated with any of the configured secrets', async () => {
            const app = setupApp({
                appCsrfSecret: ['secret1', 'secret2'],
            });

            // Get the user ID from the app
            const userId = 'test-user-123';
            const timestamp = Math.floor(Date.now() / 1000);

            // Manually create tokens using both secrets
            const crypto = require('crypto');

            const createToken = (secret: string) => {
                const hmac = crypto.createHmac('sha1', secret);
                const message = `${userId}:${timestamp}`;
                const digest = hmac.update(message).digest('hex');
                return `${digest}:${timestamp}`;
            };

            const token1 = createToken('secret1');
            const token2 = createToken('secret2');

            // Both tokens should be valid
            const res1 = await request
                .agent(app.express)
                .post('/test-csrf')
                .set('x-csrf-token', token1);

            const res2 = await request
                .agent(app.express)
                .post('/test-csrf')
                .set('x-csrf-token', token2);

            expect(res1.status).toBe(200);
            expect(res2.status).toBe(200);
        });

        it('should reject tokens generated with non-configured secrets', async () => {
            const app = setupApp({
                appCsrfSecret: ['secret1', 'secret2'],
            });

            const userId = 'test-user-123';
            const timestamp = Math.floor(Date.now() / 1000);

            // Create a token with a secret that's not in the configuration
            const crypto = require('crypto');
            const hmac = crypto.createHmac('sha1', 'wrong-secret');
            const message = `${userId}:${timestamp}`;
            const digest = hmac.update(message).digest('hex');
            const invalidToken = `${digest}:${timestamp}`;

            const res = await request
                .agent(app.express)
                .post('/test-csrf')
                .set('x-csrf-token', invalidToken);

            expect(res.status).toBe(419);
        });

        it('should work with single secret as string', async () => {
            const app = setupApp({
                appCsrfSecret: 'single-secret',
            });

            const tokenRes = await request.agent(app.express).get('/csrf-token');
            const validToken = tokenRes.body.csrfToken;

            const res = await request
                .agent(app.express)
                .post('/test-csrf')
                .set('x-csrf-token', validToken);

            expect(res.status).toBe(200);
        });

        it('should validate tokens generated with single secret', async () => {
            const app = setupApp({
                appCsrfSecret: 'single-secret',
            });

            const userId = 'test-user-123';
            const timestamp = Math.floor(Date.now() / 1000);

            // Manually create token using the configured secret
            const crypto = require('crypto');
            const hmac = crypto.createHmac('sha1', 'single-secret');
            const message = `${userId}:${timestamp}`;
            const digest = hmac.update(message).digest('hex');
            const manualToken = `${digest}:${timestamp}`;

            const res = await request
                .agent(app.express)
                .post('/test-csrf')
                .set('x-csrf-token', manualToken);

            expect(res.status).toBe(200);
        });

        it('should reject tokens generated with different single secret', async () => {
            const app = setupApp({
                appCsrfSecret: 'correct-secret',
            });

            const userId = 'test-user-123';
            const timestamp = Math.floor(Date.now() / 1000);

            // Create a token with a different secret
            const crypto = require('crypto');
            const hmac = crypto.createHmac('sha1', 'wrong-secret');
            const message = `${userId}:${timestamp}`;
            const digest = hmac.update(message).digest('hex');
            const invalidToken = `${digest}:${timestamp}`;

            const res = await request
                .agent(app.express)
                .post('/test-csrf')
                .set('x-csrf-token', invalidToken);

            expect(res.status).toBe(419);
        });
    });

    describe('Error Handling', () => {
        it('should throw error when user ID is not found', async () => {
            // Create an app where the auth handler doesn't set user ID
            const nodekit = new NodeKit({
                config: {
                    appCsrfSecret: 'test-secret',
                    appAuthPolicy: AuthPolicy.required,
                    appAuthHandler: (_req: Request, _res: Response, next: () => void) => {
                        // Don't set user ID - this should cause CSRF middleware to fail
                        next();
                    },
                },
            });

            const routes = {
                'POST /test': {
                    authPolicy: AuthPolicy.required,
                    handler: (_req: Request, res: Response) => {
                        res.status(200).json({message: 'test'});
                    },
                },
            };

            const app = new ExpressKit(nodekit, routes);
            // The error should happen when making a request, not during construction
            const res = await request.agent(app.express).post('/test');
            expect(res.status).toBe(500); // Should fail with internal server error
        });

        it('should throw error when auth method is incorrect and userId is not set in required auth policy', async () => {
            // Create an app with incorrect auth method that doesn't set userId
            const nodekit = new NodeKit({
                config: {
                    appCsrfSecret: 'test-secret',
                    appAuthPolicy: AuthPolicy.required,
                    appAuthHandler: (_req: Request, _res: Response, next: () => void) => {
                        // Incorrect auth method: doesn't set userId but calls next()
                        // This should cause CSRF middleware to fail when auth policy is required
                        next();
                    },
                },
            });

            const routes = {
                'POST /test-csrf-required': {
                    authPolicy: AuthPolicy.required,
                    handler: (_req: Request, res: Response) => {
                        res.status(200).json({message: 'should not reach here'});
                    },
                },
                'POST /test-csrf-optional': {
                    authPolicy: AuthPolicy.optional,
                    handler: (_req: Request, res: Response) => {
                        res.status(200).json({message: 'should reach here - no CSRF required'});
                    },
                },
                'POST /test-csrf-disabled': {
                    authPolicy: AuthPolicy.disabled,
                    handler: (_req: Request, res: Response) => {
                        res.status(200).json({message: 'should reach here - no auth required'});
                    },
                },
            };

            const app = new ExpressKit(nodekit, routes);

            // Test with required auth policy - should fail with 500 due to missing userId
            const resRequired = await request.agent(app.express).post('/test-csrf-required');
            expect(resRequired.status).toBe(500);
            expect(resRequired.text).toBe('Internal server error');

            // Test with optional auth policy - should pass (CSRF middleware allows missing userId)
            const resOptional = await request.agent(app.express).post('/test-csrf-optional');
            expect(resOptional.status).toBe(200);
            expect(resOptional.body.message).toBe('should reach here - no CSRF required');

            // Test with disabled auth policy - should pass (no auth required)
            const resDisabled = await request.agent(app.express).post('/test-csrf-disabled');
            expect(resDisabled.status).toBe(200);
            expect(resDisabled.body.message).toBe('should reach here - no auth required');
        });
    });
});
