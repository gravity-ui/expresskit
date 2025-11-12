/* eslint-disable callback-return */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import request from 'supertest';
import {AppContext, NodeKit} from '@gravity-ui/nodekit';

import {ExpressKit, NextFunction, Request, Response} from '..';

describe('Context Lifecycle', () => {
    describe('Middleware Context Management', () => {
        it('should close context on sync next()', async () => {
            const contextEvents: Array<{event: string; contextClosed: boolean}> = [];
            let middlewareCtx: AppContext | null = null;
            let handlerCtx: AppContext | null = null;

            const syncMiddleware = (req: Request, _res: Response, next: NextFunction) => {
                middlewareCtx = req.ctx;
                contextEvents.push({
                    event: 'before-next',
                    contextClosed: middlewareCtx!.abortSignal.aborted,
                });
                next();
                contextEvents.push({
                    event: 'after-next',
                    contextClosed: middlewareCtx!.abortSignal.aborted,
                });
            };

            const nodekit = new NodeKit();
            const app = new ExpressKit(nodekit, {
                'GET /test': {
                    beforeAuth: [syncMiddleware],
                    handler: (req: Request, res: Response) => {
                        handlerCtx = req.ctx;
                        contextEvents.push({
                            event: 'handler',
                            contextClosed: handlerCtx!.abortSignal.aborted,
                        });
                        res.json({ok: true});
                    },
                },
            });

            await request.agent(app.express).get('/test');

            expect(middlewareCtx).not.toBe(handlerCtx);
            expect(middlewareCtx!.abortSignal.aborted).toBe(true);
            expect(handlerCtx!.abortSignal.aborted).toBe(true);
            expect(contextEvents[0]).toEqual({event: 'before-next', contextClosed: false});
            expect(contextEvents[1]).toEqual({event: 'handler', contextClosed: false});
            expect(contextEvents[2]).toEqual({event: 'after-next', contextClosed: true});
        });

        it('should close context only after async next() is called', async () => {
            const contextEvents: Array<{event: string; contextClosed: boolean}> = [];
            let middlewareCtx: AppContext | null = null;

            const asyncMiddleware = (req: Request, _res: Response, next: NextFunction) => {
                middlewareCtx = req.ctx;
                setTimeout(() => {
                    contextEvents.push({
                        event: 'before-next',
                        contextClosed: middlewareCtx!.abortSignal.aborted,
                    });
                    next();
                    contextEvents.push({
                        event: 'after-next',
                        contextClosed: middlewareCtx!.abortSignal.aborted,
                    });
                }, 10);
            };

            const nodekit = new NodeKit();
            const app = new ExpressKit(nodekit, {
                'GET /test': {
                    beforeAuth: [asyncMiddleware],
                    handler: (req: Request, res: Response) => {
                        contextEvents.push({
                            event: 'handler',
                            contextClosed: req.ctx.abortSignal.aborted,
                        });
                        res.json({ok: true});
                    },
                },
            });

            await request.agent(app.express).get('/test');

            expect(middlewareCtx!.abortSignal.aborted).toBe(true);
            expect(contextEvents[0]).toEqual({event: 'before-next', contextClosed: false});
            expect(contextEvents[1]).toEqual({event: 'handler', contextClosed: false});
            expect(contextEvents[2]).toEqual({event: 'after-next', contextClosed: true});
        });

        it('should close context and call next(error) on middleware error', async () => {
            let middlewareCtx: AppContext | null = null;
            let handlerCalled = false;

            const failingMiddleware = (req: Request, _res: Response, _next: NextFunction) => {
                middlewareCtx = req.ctx;
                throw new Error('Middleware error');
            };

            const nodekit = new NodeKit();
            const app = new ExpressKit(nodekit, {
                'GET /test': {
                    beforeAuth: [failingMiddleware],
                    handler: (_req: Request, res: Response) => {
                        handlerCalled = true;
                        res.json({ok: true});
                    },
                },
            });

            const response = await request.agent(app.express).get('/test');

            expect(response.status).toBe(500);
            expect(handlerCalled).toBe(false);
            expect(middlewareCtx!.abortSignal.aborted).toBe(true);
        });

        it('should handle middleware that sends response without calling next()', async () => {
            let middlewareCtx: AppContext | null = null;
            let handlerCalled = false;

            const responseMiddleware = (req: Request, res: Response, _next: NextFunction) => {
                middlewareCtx = req.ctx;
                res.json({early: true});
                // Don't call next()
            };

            const nodekit = new NodeKit();
            const app = new ExpressKit(nodekit, {
                'GET /test': {
                    beforeAuth: [responseMiddleware],
                    handler: (_req: Request, res: Response) => {
                        handlerCalled = true;
                        res.json({ok: true});
                    },
                },
            });

            const response = await request.agent(app.express).get('/test');

            expect(response.body).toEqual({early: true});
            expect(handlerCalled).toBe(false);
            expect(middlewareCtx!.abortSignal.aborted).toBe(true);
        });

        it('should ignore errors after next() is called', async () => {
            let middlewareCtx: AppContext | null = null;
            let handlerCtx: AppContext | null = null;
            let errorAfterNext: Error | null = null;

            const problematicMiddleware = async (
                req: Request,
                _res: Response,
                next: NextFunction,
            ) => {
                middlewareCtx = req.ctx;
                next();
                errorAfterNext = new Error('Error after next');
                throw errorAfterNext;
            };

            const nodekit = new NodeKit();
            const app = new ExpressKit(nodekit, {
                'GET /test': {
                    beforeAuth: [problematicMiddleware],
                    handler: (req: Request, res: Response) => {
                        handlerCtx = req.ctx;
                        res.json({ok: true});
                    },
                },
            });

            const response = await request.agent(app.express).get('/test');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ok: true});
            expect(middlewareCtx).toBeTruthy();
            expect(handlerCtx).toBeTruthy();
            expect(handlerCtx).not.toBe(middlewareCtx);
            expect(errorAfterNext).toBeTruthy();
            expect(middlewareCtx!.abortSignal.aborted).toBe(true);
            expect(handlerCtx!.abortSignal.aborted).toBe(true);
        });
    });

    describe('Route Handler Context Management', () => {
        it('should close context on successful handler execution', async () => {
            let handlerCtx: AppContext | null = null;
            let originalCtx: AppContext | null = null;

            const nodekit = new NodeKit();
            const app = new ExpressKit(nodekit, {
                'GET /test': (req: Request, res: Response) => {
                    handlerCtx = req.ctx;
                    originalCtx = req.originalContext;
                    res.json({ok: true});
                },
            });

            await request.agent(app.express).get('/test');

            expect(handlerCtx).toBeTruthy();
            expect(originalCtx).toBeTruthy();
            expect(handlerCtx).not.toBe(originalCtx);
            expect(handlerCtx!.abortSignal.aborted).toBe(true);
            expect(originalCtx!.abortSignal.aborted).toBe(true);
        });

        it('should close context with fail() on handler error', async () => {
            let handlerCtx: AppContext | null = null;

            const nodekit = new NodeKit();
            const app = new ExpressKit(nodekit, {
                'GET /test': (req: Request, _res: Response) => {
                    handlerCtx = req.ctx;
                    throw new Error('Handler error');
                },
            });

            const response = await request.agent(app.express).get('/test');

            expect(response.status).toBe(500);
            expect(handlerCtx).toBeTruthy();
            expect(handlerCtx!.abortSignal.aborted).toBe(true);
        });

        it('should properly restore req.ctx to originalContext after handler', async () => {
            let ctxDuringHandler: AppContext | null = null;
            let originalCtxDuringHandler: AppContext | null = null;

            const nodekit = new NodeKit();
            const app = new ExpressKit(nodekit, {
                'GET /test': (req: Request, res: Response) => {
                    ctxDuringHandler = req.ctx;
                    originalCtxDuringHandler = req.originalContext;
                    res.json({ok: true});
                },
            });

            await request.agent(app.express).get('/test');

            expect(ctxDuringHandler).not.toBe(originalCtxDuringHandler);
            expect(ctxDuringHandler!.parentContext).toBe(originalCtxDuringHandler);
        });
    });

    describe('Context Chain', () => {
        it('should create proper context chain: original -> middleware -> handler', async () => {
            let middlewareCtx: AppContext | null = null;
            let middlewareOriginalCtx: AppContext | null = null;
            let handlerCtx: AppContext | null = null;
            let handlerOriginalCtx: AppContext | null = null;

            const middleware = (req: Request, _res: Response, next: NextFunction) => {
                middlewareCtx = req.ctx;
                middlewareOriginalCtx = req.originalContext;
                next();
            };

            const nodekit = new NodeKit();
            const app = new ExpressKit(nodekit, {
                'GET /test': {
                    beforeAuth: [middleware],
                    handler: (req: Request, res: Response) => {
                        handlerCtx = req.ctx;
                        handlerOriginalCtx = req.originalContext;
                        res.json({ok: true});
                    },
                },
            });

            await request.agent(app.express).get('/test');

            expect(middlewareCtx).toBeTruthy();
            expect(middlewareOriginalCtx).toBeTruthy();
            expect(handlerCtx).toBeTruthy();
            expect(handlerOriginalCtx).toBeTruthy();

            expect(middlewareCtx).not.toBe(handlerCtx);
            expect(middlewareCtx).not.toBe(middlewareOriginalCtx);
            expect(handlerCtx).not.toBe(middlewareOriginalCtx);
            expect(middlewareOriginalCtx).toBe(handlerOriginalCtx);

            expect(middlewareCtx!.parentContext).toBe(middlewareOriginalCtx);
            expect(handlerCtx!.parentContext).toBe(middlewareOriginalCtx);

            expect(middlewareCtx!.abortSignal.aborted).toBe(true);
            expect(handlerCtx!.abortSignal.aborted).toBe(true);
            expect(middlewareOriginalCtx!.abortSignal.aborted).toBe(true);
        });
    });
});
