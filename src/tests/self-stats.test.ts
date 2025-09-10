import {AppRoutes, ExpressKit, Request, Response} from '..';
import {DEFAULT_REQUEST_ID_HEADER} from '../constants';
import {AppConfig, NodeKit} from '@gravity-ui/nodekit';
import request from 'supertest';

const APP_NAME = 'app';

const setupApp = ({config}: {config?: AppConfig} = {}) => {
    const nodekit = new NodeKit({
        config: {
            appName: APP_NAME,
            appTelemetryChEnableSelfStats: true,
            ...config,
        },
    });
    const stats = jest.fn();
    nodekit.ctx.stats = stats;

    const routes: AppRoutes = {
        'GET /ping-self-stats': {
            handler: (_: Request, res: Response) => {
                res.status(200);
                res.send({status: 'ok'});
            },
        },
        'GET /ping-no-self-stats': {
            handler: (_: Request, res: Response) => {
                res.status(200);
                res.send({status: 'ok'});
            },
            disableSelfStats: true,
        },
    };

    const app = new ExpressKit(nodekit, routes);

    return {app, stats};
};

describe('self stats telemetry', () => {
    const env = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {...env, APP_NAME};
    });

    afterEach(() => {
        process.env = env;
    });

    it('self stats telemetry sended', async () => {
        const {app, stats} = setupApp();

        const agent = request.agent(app.express);
        const requestId = Math.random().toString();

        await agent.get('/ping-self-stats').set(DEFAULT_REQUEST_ID_HEADER, requestId).expect(200);

        // last self stats data
        const stat = stats.mock.calls?.pop() || {};

        expect(stat).toMatchObject([
            {
                service: 'self',
                action: 'handler',
                responseStatus: 200,
                requestId,
                requestMethod: 'GET',
                requestUrl: '/ping-self-stats',
                traceId: '',
            },
        ]);
    });

    it('self stats telemetry skipped', async () => {
        const {app, stats} = setupApp();

        const agent = request.agent(app.express);
        const requestId = Math.random().toString();

        await agent
            .get('/ping-no-self-stats')
            .set(DEFAULT_REQUEST_ID_HEADER, requestId)
            .expect(200);

        // last self stats data
        const stat = stats.mock.calls?.pop() || null;

        expect(stat).toBeNull();
    });
});
