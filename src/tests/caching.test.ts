import {ExpressKit, Request, Response} from '..';
import {NodeKit} from '@gravity-ui/nodekit';
import request from 'supertest';

describe('Caching Control', () => {
    it('should set no-cache headers by default', async () => {
        const nodekit = new NodeKit({config: {}});
        const app = new ExpressKit(nodekit, {
            'GET /test': (_req: Request, res: Response) => {
                res.json({ok: true});
            },
        });

        const res = await request.agent(app.express).get('/test');
        expect(res.headers['cache-control']).toBe(
            'no-store, max-age=0, must-revalidate, proxy-revalidate',
        );
    });

    it('should allow caching when expressEnableCaching is true', async () => {
        const nodekit = new NodeKit({config: {expressEnableCaching: true}});
        const app = new ExpressKit(nodekit, {
            'GET /test': (_req: Request, res: Response) => {
                res.json({ok: true});
            },
        });

        const res = await request.agent(app.express).get('/test');
        expect(res.headers['cache-control']).toBeUndefined();
    });

    it('should respect route-level enableCaching flag', async () => {
        const nodekit = new NodeKit({config: {}});
        const app = new ExpressKit(nodekit, {
            'GET /cached': {
                enableCaching: true,
                handler: (_req: Request, res: Response) => {
                    res.json({ok: true});
                },
            },
            'GET /not-cached': {
                enableCaching: false,
                handler: (_req: Request, res: Response) => {
                    res.json({ok: true});
                },
            },
        });

        const cached = await request.agent(app.express).get('/cached');
        expect(cached.headers['cache-control']).toBeUndefined();

        const notCached = await request.agent(app.express).get('/not-cached');
        expect(notCached.headers['cache-control']).toBe(
            'no-store, max-age=0, must-revalidate, proxy-revalidate',
        );
    });

    it('should allow route override of global config', async () => {
        const nodekit = new NodeKit({config: {expressEnableCaching: true}});
        const app = new ExpressKit(nodekit, {
            'GET /override': {
                enableCaching: false,
                handler: (_req: Request, res: Response) => {
                    res.json({ok: true});
                },
            },
        });

        const res = await request.agent(app.express).get('/override');
        expect(res.headers['cache-control']).toBe(
            'no-store, max-age=0, must-revalidate, proxy-revalidate',
        );
    });

    it('should set enableCaching in routeInfo', async () => {
        const nodekit = new NodeKit({config: {expressEnableCaching: true}});
        const app = new ExpressKit(nodekit, {
            'GET /info': (req: Request, res: Response) => {
                res.json({enableCaching: req.routeInfo.enableCaching});
            },
        });

        const res = await request.agent(app.express).get('/info');
        expect(res.body.enableCaching).toBe(true);
    });
});
