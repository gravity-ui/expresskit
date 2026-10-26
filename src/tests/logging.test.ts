import {ExpressKit, Request, Response} from '..';
import {DEFAULT_REQUEST_ID_HEADER} from '../constants';
import {AppConfig, NodeKit} from '@gravity-ui/nodekit';
import request from 'supertest';

const genRandomId = (length = 16) => {
    return [...Array(length)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
};

const APP_NAME = 'app';
const USER_AGENT_HEADER = 'user-agent';
const UBER_TRACE_ID_KEY = 'uber-trace-id';
const X_TRACE_ID_KEY = 'x-trace-id';

const setupApp = ({config}: {config?: AppConfig} = {}) => {
    const logger = {
        write: jest.fn(),
    };

    const nodekit = new NodeKit({
        config: {
            appLoggingDestination: logger,
            appName: APP_NAME,
            appTracingEnabled: true,
            ...config,
        },
    });
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
        'GET /mutate': {
            handler: (req: Request, res: Response) => {
                req.headers['x-log-request'] = 'false';
                res.send({status: 'ok'});
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
            .set(USER_AGENT_HEADER, userAgent);

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

    it('filters request logs by path while exposing the original query and request context', async () => {
        const requestLoggingFilter = jest.fn((req: Request) => {
            expect(req.ctx).toBeDefined();
            expect(req.route).toBeUndefined();
            return req.path !== '/get';
        });
        const {app, logger} = setupApp({config: {requestLoggingFilter}});
        const agent = request.agent(app.express);

        await agent.get('/get?healthcheck=true').expect(200);

        expect(requestLoggingFilter).toHaveBeenCalledTimes(1);
        expect(requestLoggingFilter.mock.calls[0][0].originalUrl).toBe('/get?healthcheck=true');
        expect(logger.write).not.toHaveBeenCalled();

        await agent.post('/post').expect(200);

        expect(requestLoggingFilter).toHaveBeenCalledTimes(2);
        expect(logger.write.mock.calls.map(([line]) => JSON.parse(line))).toEqual([
            expect.objectContaining({
                msg: expect.stringContaining('Request started'),
                level: 30,
                req: expect.objectContaining({method: 'POST', url: '/post'}),
            }),
            expect.objectContaining({
                msg: expect.stringContaining('Request completed'),
                level: 30,
                res: expect.objectContaining({statusCode: '200'}),
            }),
        ]);
    });

    it('keeps error logs for filtered requests', async () => {
        const {app, logger} = setupApp({config: {requestLoggingFilter: () => false}});
        const requestId = 'filtered-error';

        await request(app.express)
            .get('/500')
            .set(DEFAULT_REQUEST_ID_HEADER, requestId)
            .expect(500);

        expect(logger.write.mock.calls.map(([line]) => JSON.parse(line))).toEqual([
            expect.objectContaining({
                msg: `[Express GET] Request failed [${requestId}]`,
                level: 50,
                req: expect.objectContaining({id: requestId, method: 'GET', url: '/500'}),
                res: expect.objectContaining({statusCode: '500'}),
            }),
        ]);
    });

    it('keeps handler logs and request metadata for filtered requests', async () => {
        const {app, logger} = setupApp({config: {requestLoggingFilter: () => false}});
        const requestId = 'filtered-handler';

        await request(app.express)
            .get('/log?q=filtered')
            .set(DEFAULT_REQUEST_ID_HEADER, requestId)
            .expect(200);

        expect(logger.write.mock.calls.map(([line]) => JSON.parse(line))).toEqual([
            expect.objectContaining({
                msg: `[Express GET] [handler] log from handler [${requestId}]`,
                level: 30,
                req: expect.objectContaining({id: requestId, method: 'GET', url: '/log'}),
                query: 'filtered',
            }),
        ]);
    });

    it('evaluates the filter once before the handler mutates the request', async () => {
        const requestLoggingFilter = jest.fn(
            (req: Request) => req.headers['x-log-request'] === 'true',
        );
        const {app, logger} = setupApp({config: {requestLoggingFilter}});

        await request(app.express).get('/mutate').set('x-log-request', 'true').expect(200);

        expect(requestLoggingFilter).toHaveBeenCalledTimes(1);
        expect(requestLoggingFilter.mock.calls[0][0].headers['x-log-request']).toBe('false');
        expect(logger.write.mock.calls.map(([line]) => JSON.parse(line).msg)).toEqual([
            expect.stringContaining('Request started'),
            expect.stringContaining('Request completed'),
        ]);
    });

    it('filters logs for requests without a matching route', async () => {
        const requestLoggingFilter = jest.fn(() => false);
        const {app, logger} = setupApp({config: {requestLoggingFilter}});

        await request(app.express).get('/missing').expect(404);

        expect(requestLoggingFilter).toHaveBeenCalledTimes(1);
        expect(logger.write).not.toHaveBeenCalled();
    });

    it('log message should not contain req id if appLoggingOmitIdInMessages is specified', async () => {
        const {app, logger} = setupApp({config: {appLoggingOmitIdInMessages: true}});

        const agent = request.agent(app.express);

        const requestId = Math.random().toString();
        const userAgent = 'user-agent-' + Math.random().toString();

        await agent
            .get('/get')
            .set(DEFAULT_REQUEST_ID_HEADER, requestId)
            .set(USER_AGENT_HEADER, userAgent);

        // last log with response
        let log = JSON.parse(logger.write.mock.calls?.pop() || '{}');

        // check response log
        expect(log).toMatchObject({
            msg: `[Express GET] Request completed`,
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
            msg: `[Express GET] Request started`,
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
            .set(USER_AGENT_HEADER, userAgent);

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
                url: '/log',
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
                url: '/log',
            },
            query,
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
                url: `/log?q=${query}`,
            },
        });
    });

    it('log should contain traceId and spanId', async () => {
        const {app, logger} = setupApp();

        const agent = request.agent(app.express);

        const requestId = Math.random().toString();
        const userAgent = 'user-agent-' + Math.random().toString();

        const traceId = genRandomId(32);
        const spanId = genRandomId(16);
        const traceFlags = '01';
        const uberTraceId = `${traceId}:${spanId}:0:${traceFlags}`;

        await agent
            .get('/get')
            .set(DEFAULT_REQUEST_ID_HEADER, requestId)
            .set(USER_AGENT_HEADER, userAgent)
            .set(UBER_TRACE_ID_KEY, uberTraceId);

        // last log with response
        let log = JSON.parse(logger.write.mock.calls?.pop() || '{}');

        // check response log
        expect(log).toMatchObject({
            msg: `[Express GET] Request completed [${requestId}]`,
            level: 30,
            name: APP_NAME,
            time: expect.any(Number),
            traceId,
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
                    [X_TRACE_ID_KEY]: traceId,
                },
            },
        });

        expect(log?.spanId).toBeTruthy();

        // first log with request
        log = JSON.parse(logger.write.mock.calls?.pop() || '{}');

        // check request log
        expect(log).toMatchObject({
            msg: `[Express GET] Request started [${requestId}]`,
            level: 30,
            name: APP_NAME,
            time: expect.any(Number),
            traceId,
            req: {
                id: requestId,
                method: 'GET',
                url: '/get',
                headers: {
                    [DEFAULT_REQUEST_ID_HEADER]: requestId,
                    [UBER_TRACE_ID_KEY]: uberTraceId,
                },
                remoteAddress: expect.any(String),
                remotePort: expect.any(Number),
            },
        });

        expect(log?.spanId).toBeTruthy();
    });

    it('should use custom request id header name when expressRequestIdHeaderName is set', async () => {
        const customHeaderName = 'x-custom-request-id';
        const {app, logger} = setupApp({
            config: {
                expressRequestIdHeaderName: customHeaderName,
            },
        });

        const agent = request.agent(app.express);

        const requestId = Math.random().toString();

        const response = await agent.get('/get').set(customHeaderName, requestId);

        // Check that response contains custom header
        expect(response.headers[customHeaderName]).toBe(requestId);

        // last log with response
        let log = JSON.parse(logger.write.mock.calls?.pop() || '{}');

        // Check response log with custom header
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
                    [customHeaderName]: requestId,
                },
            },
        });

        // first log with request
        log = JSON.parse(logger.write.mock.calls?.pop() || '{}');

        // Check request log contains correct requestId from custom header
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
                    [customHeaderName]: requestId,
                },
                remoteAddress: expect.any(String),
                remotePort: expect.any(Number),
            },
        });
    });
});
