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
        'GET /ping-no-log': {
            handler: (_: Request, res: Response) => {
                res.send({status: 'ok'});
            },
        },
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
        'GET /redirect': {
            handler: (_: Request, res: Response) => {
                res.redirect('https://example.com/callback?token=secret&state=1');
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

    it('redacts sensitive query params in the logged location header', async () => {
        const {app, logger} = setupApp({config: {appSensitiveQueryParams: ['token']}});

        const response = await request(app.express).get('/redirect').expect(302);

        expect(response.headers.location).toBe('https://example.com/callback?token=secret&state=1');
        const log = JSON.parse(logger.write.mock.calls?.pop() || '{}');
        expect(log.res.headers.location).toBe(
            'https://example.com/callback?token=%5BREDACTED%5D&state=1',
        );
    });

    describe('logged headers whitelist', () => {
        it('logs only whitelisted headers', async () => {
            const {app, logger} = setupApp({
                config: {
                    appLoggingRequestHeaders: ['User-Agent'],
                    appLoggingResponseHeaders: ['Content-Type'],
                },
            });

            await request(app.express)
                .get('/get')
                .set(USER_AGENT_HEADER, 'test-agent')
                .set('x-forwarded-for', '127.0.0.1')
                .expect(200);

            const [started, completed] = logger.write.mock.calls.map(([line]) => JSON.parse(line));
            expect(started.req.headers).toStrictEqual({[USER_AGENT_HEADER]: 'test-agent'});
            expect(completed.res.headers).toStrictEqual({'content-type': expect.any(String)});
        });

        it('omits headers when logging is disabled', async () => {
            const {app, logger} = setupApp({
                config: {appLoggingRequestHeaders: false, appLoggingResponseHeaders: false},
            });

            await request(app.express).get('/get').set(USER_AGENT_HEADER, 'test-agent').expect(200);

            const [started, completed] = logger.write.mock.calls.map(([line]) => JSON.parse(line));
            expect(started.req).not.toHaveProperty('headers');
            expect(completed.res).not.toHaveProperty('headers');
            expect(completed.res.statusCode).toBe('200');
        });
    });

    describe('appLoggingRequestFilter', () => {
        it('does not log requests excluded by path, including requests with query parameters', async () => {
            const appLoggingRequestFilter = jest.fn((req: Request) => req.path !== '/ping-no-log');
            const {app, logger} = setupApp({config: {appLoggingRequestFilter}});

            await request(app.express).get('/ping-no-log?healthcheck=true').expect(200);

            expect(logger.write).not.toHaveBeenCalled();
            expect(appLoggingRequestFilter).toHaveBeenCalledTimes(1);
        });

        it('logs request start and completion for paths allowed by the filter', async () => {
            const {app, logger} = setupApp({
                config: {appLoggingRequestFilter: (req) => req.path !== '/ping-no-log'},
            });
            const requestId = 'allowed-request';

            await request(app.express)
                .get('/get')
                .set(DEFAULT_REQUEST_ID_HEADER, requestId)
                .expect(200);

            expect(logger.write).toHaveBeenCalledTimes(2);
            const [started, completed] = logger.write.mock.calls.map(([line]) => JSON.parse(line));
            expect(started).toMatchObject({
                msg: `[Express GET] Request started [${requestId}]`,
                level: 30,
                req: {method: 'GET', url: '/get'},
            });
            expect(completed).toMatchObject({
                msg: `[Express GET] Request completed [${requestId}]`,
                level: 30,
                res: {statusCode: '200'},
            });
        });

        it('still logs 5xx errors for excluded paths', async () => {
            const {app, logger} = setupApp({
                config: {appLoggingRequestFilter: (req) => req.path !== '/500'},
            });
            const requestId = 'filtered-error';

            await request(app.express)
                .get('/500')
                .set(DEFAULT_REQUEST_ID_HEADER, requestId)
                .expect(500);

            expect(logger.write).toHaveBeenCalledTimes(1);
            const log = JSON.parse(logger.write.mock.calls[0][0]);
            expect(log).toMatchObject({
                msg: `[Express GET] Request failed [${requestId}]`,
                level: 50,
                req: {id: requestId, method: 'GET', url: '/500'},
                res: {statusCode: '500'},
            });
        });

        it('still logs handler messages for excluded paths', async () => {
            const {app, logger} = setupApp({
                config: {appLoggingRequestFilter: (req) => req.path !== '/log'},
            });
            const requestId = 'filtered-handler';

            await request(app.express)
                .get('/log?q=filtered')
                .set(DEFAULT_REQUEST_ID_HEADER, requestId)
                .expect(200);

            expect(logger.write).toHaveBeenCalledTimes(1);
            const log = JSON.parse(logger.write.mock.calls[0][0]);
            expect(log).toMatchObject({
                msg: `[Express GET] [handler] log from handler [${requestId}]`,
                level: 30,
                req: {id: requestId, method: 'GET', url: '/log'},
                query: 'filtered',
            });
        });

        it('does not log excluded paths even when no route matches', async () => {
            const {app, logger} = setupApp({
                config: {appLoggingRequestFilter: (req) => req.path !== '/missing'},
            });

            await request(app.express).get('/missing').expect(404);

            expect(logger.write).not.toHaveBeenCalled();
        });
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
