import {ExpressKit, Request, Response} from '..';
import {DEFAULT_REQUEST_ID_HEADER} from '../constants';
import {NodeKit} from '@gravity-ui/nodekit';
import request from 'supertest';

const APP_NAME = 'app';

const setupApp = () => {
    const logger = {
        write: jest.fn(),
    };

    const nodekit = new NodeKit({config: {appLoggingDestination: logger, appName: 'app'}});
    const routes = {
        'GET /get': {
            handler: (_: Request, res: Response) => {
                res.status(200);
                res.send({status: 'ok'});
            },
        },
        'POST /post': {
            handler: (_: Request, res: Response) => {
                res.status(200);
                res.send({status: 'ok'});
            },
        },
        'GET /500': {
            handler: (_: Request, res: Response) => {
                res.status(500);
                res.send({status: 'error'});
            },
        },
        'GET /log': {
            handler: (req: Request, res: Response) => {
                req.ctx.log('log from handler', {
                    query: req.query['q'],
                });
                res.status(200);
                res.send({status: 'ok'});
            },
        },
    };

    const app = new ExpressKit(nodekit, routes);

    return {app, logger};
};

describe('log system', () => {
    const env = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {...env, APP_NAME};
    });

    afterEach(() => {
        process.env = env;
    });

    it('log should contain req and res field with headers', async () => {
        const {app, logger} = setupApp();

        const agent = request.agent(app.express);

        const requestId = Math.random().toString();
        const userAgent = 'user-agent-' + Math.random().toString();

        await agent
            .get('/get')
            .set(DEFAULT_REQUEST_ID_HEADER, requestId)
            .set('user-agent', userAgent);

        // last log with response
        let log = JSON.parse(logger.write.mock.calls?.pop() || '{}');

        // check response log
        expect(log).toMatchObject({
            msg: `[Express GET] Request completed [${requestId}]`,
            level: 30,
            name: APP_NAME,
            time: expect.any(Number),
            req: {
                id: requestId,
                method: 'GET',
                url: '/get',
            },
            res: {
                statusCode: '200',
                responseTime: expect.any(Number),
                headers: {
                    [DEFAULT_REQUEST_ID_HEADER]: requestId,
                },
            },
        });

        // first log with request
        log = JSON.parse(logger.write.mock.calls?.pop() || '{}');

        // check request log
        expect(log).toMatchObject({
            msg: `[Express GET] Request started [${requestId}]`,
            level: 30,
            name: APP_NAME,
            time: expect.any(Number),
            req: {
                id: requestId,
                method: 'GET',
                url: '/get',
                headers: {
                    [DEFAULT_REQUEST_ID_HEADER]: requestId,
                },
                remoteAddress: expect.any(String),
                remotePort: expect.any(Number),
            },
        });
    });

    it('log POST should contain same fields as GET', async () => {
        const {app, logger} = setupApp();

        const agent = request.agent(app.express);

        const requestId = Math.random().toString();
        const userAgent = 'user-agent-' + Math.random().toString();

        await agent
            .post('/post')
            .set(DEFAULT_REQUEST_ID_HEADER, requestId)
            .set('user-agent', userAgent);

        // last log with response
        let log = JSON.parse(logger.write.mock.calls?.pop() || '{}');

        // check response log
        expect(log).toMatchObject({
            msg: `[Express POST] Request completed [${requestId}]`,
            level: 30,
            name: APP_NAME,
            time: expect.any(Number),
            req: {
                id: requestId,
                method: 'POST',
                url: '/post',
            },
            res: {
                statusCode: '200',
                responseTime: expect.any(Number),
                headers: {
                    [DEFAULT_REQUEST_ID_HEADER]: requestId,
                },
            },
        });

        // first log with request
        log = JSON.parse(logger.write.mock.calls?.pop() || '{}');

        // check request log
        expect(log).toMatchObject({
            msg: `[Express POST] Request started [${requestId}]`,
            level: 30,
            name: APP_NAME,
            time: expect.any(Number),
            req: {
                id: requestId,
                method: 'POST',
                url: '/post',
                headers: {
                    [DEFAULT_REQUEST_ID_HEADER]: requestId,
                },
                remoteAddress: expect.any(String),
                remotePort: expect.any(Number),
            },
        });
    });

    it('log with error should contain error data', async () => {
        const {app, logger} = setupApp();

        const agent = request.agent(app.express);

        const requestId = Math.random().toString();

        await agent.get('/500').set(DEFAULT_REQUEST_ID_HEADER, requestId);

        // last log with response
        const log = JSON.parse(logger.write.mock.calls?.pop() || '{}');

        // check response error log
        expect(log).toMatchObject({
            msg: `[Express GET] Request failed [${requestId}]`,
            level: 50,
            req: {
                id: requestId,
                method: 'GET',
                url: '/500',
            },
            res: {
                statusCode: '500',
                responseTime: expect.any(Number),
                headers: {
                    [DEFAULT_REQUEST_ID_HEADER]: requestId,
                },
            },
        });
    });

    it('log from handler should contain parent ctx request data', async () => {
        const {app, logger} = setupApp();

        const agent = request.agent(app.express);

        const requestId = Math.random().toString();
        const query = Math.random().toString();

        await agent.get(`/log?q=${query}`).set(DEFAULT_REQUEST_ID_HEADER, requestId);

        // last log with response
        let log = JSON.parse(logger.write.mock.calls?.pop() || '{}');

        // check response log
        expect(log).toMatchObject({
            msg: `[Express GET] Request completed [${requestId}]`,
            level: 30,
            name: APP_NAME,
            time: expect.any(Number),
            req: {
                id: requestId,
                method: 'GET',
                url: `/log?q=${query}`,
            },
            res: {
                statusCode: '200',
                responseTime: expect.any(Number),
                headers: {
                    [DEFAULT_REQUEST_ID_HEADER]: requestId,
                },
            },
        });

        // handler log
        log = JSON.parse(logger.write.mock.calls?.pop() || '{}');

        // check handler log
        expect(log).toMatchObject({
            msg: `[Express GET] [handler] log from handler [${requestId}]`,
            level: 30,
            name: APP_NAME,
            time: expect.any(Number),
            req: {
                id: requestId,
                method: 'GET',
                url: `/log?q=${query}`,
            },
            query,
        });
    });
});
