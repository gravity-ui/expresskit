import {AuthPolicy, ExpressKit, Request, Response} from '..';
import {NodeKit, USER_ID_PARAM_NAME} from '@gravity-ui/nodekit';
import request from 'supertest';

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
            appCsrfCookieName: 'CSRF-TOKEN',
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
                    csrfToken: res.locals.csrfToken,
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

        it('should set CSRF token in cookie', async () => {
            const app = setupApp();
            const res = await request.agent(app.express).get('/csrf-token');

            expect(res.headers['set-cookie']).toBeDefined();
            const setCookieHeaders = res.headers['set-cookie'] as unknown as string[] | undefined;
            const csrfCookie = setCookieHeaders?.find((cookie: string) =>
                cookie.startsWith('CSRF-TOKEN='),
            );
            expect(csrfCookie).toBeDefined();
            expect(csrfCookie).toContain('Secure');
            expect(csrfCookie).toContain('SameSite');

            // Extract the token value from the cookie and verify it matches the header
            const cookieToken = csrfCookie?.split(';')[0].split('=')[1];
            expect(decodeURIComponent(cookieToken!)).toBe(res.headers['x-csrf-token']);
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

        it('should accept valid CSRF token in x-xsrf-token header', async () => {
            const app = setupApp();

            const tokenRes = await request.agent(app.express).get('/csrf-token');
            const validToken = tokenRes.body.csrfToken;

            const res = await request
                .agent(app.express)
                .post('/test-csrf')
                .set('x-xsrf-token', validToken);

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

        it('should work with custom CSRF cookie name', async () => {
            const app = setupApp({appCsrfCookieName: 'CUSTOM-CSRF-TOKEN'});

            const res = await request.agent(app.express).get('/csrf-token');

            expect(res.headers['set-cookie']).toBeDefined();
            const setCookieHeaders = res.headers['set-cookie'] as unknown as string[] | undefined;
            const csrfCookie = setCookieHeaders?.find((cookie: string) =>
                cookie.startsWith('CUSTOM-CSRF-TOKEN='),
            );
            expect(csrfCookie).toBeDefined();
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
    });
});
