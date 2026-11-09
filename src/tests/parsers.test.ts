import type {AppConfig, AppContext} from '@gravity-ui/nodekit';
import express, {type ErrorRequestHandler} from 'express';
import request from 'supertest';
import {z} from 'zod';

import {setupParsers} from '../parsers';
import {withContract} from '../validator/with-contract';

const disabledParsers = {
    expressDisableBodyParserJSON: true,
    expressDisableBodyParserURLEncoded: true,
};

function setupApp(config: AppConfig = {}) {
    const app = express();
    setupParsers({config} as AppContext, app);
    app.post('/body', (req, res) => res.json({body: req.body}));
    return app;
}

describe('body parser compatibility', () => {
    test.each([
        {},
        {expressDisableBodyParserURLEncoded: true},
        {expressDisableBodyParserJSON: true},
        {...disabledParsers, expressBodyParserRawConfig: {type: 'application/octet-stream'}},
    ])('initializes absent and unparsed bodies with config %j', async (config) => {
        const app = setupApp(config);
        await request(app).post('/body').expect(200, {body: {}});
        await request(app)
            .post('/body')
            .type('text/plain')
            .send('unparsed')
            .expect(200, {body: {}});
    });

    test('leaves the body absent when all parsers are disabled', async () => {
        await request(setupApp(disabledParsers)).post('/body').expect(200, {});
    });

    test('makes the initial body available to custom type and verify callbacks', async () => {
        const seenBodies: unknown[] = [];
        const app = setupApp({
            expressBodyParserJSONConfig: {
                type: (req) => {
                    seenBodies.push((req as express.Request).body);
                    return true;
                },
                verify: (req) => {
                    seenBodies.push((req as express.Request).body);
                },
            },
        });
        await request(app)
            .post('/body')
            .send({value: 1})
            .expect(200, {body: {value: 1}});
        expect(seenBodies).toEqual([{}, {}]);
    });

    test('preserves an existing parsed body', async () => {
        const app = express();
        app.use((req, _res, next) => {
            req.body = {value: 'already parsed'};
            next();
        });
        setupParsers({config: {}} as AppContext, app);
        app.post('/body', (req, res) => res.json({body: req.body}));
        await request(app)
            .post('/body')
            .expect(200, {body: {value: 'already parsed'}});
    });

    test('allows object contracts to apply defaults to an absent body', async () => {
        const app = setupApp();
        const body = z.object({pageSize: z.number().default(20)});
        const handler = withContract({
            request: {body},
            response: {content: {200: body}},
        })(async (req, res) => res.sendTyped(200, req.body));
        app.post('/defaults', (req, res, next) => {
            Promise.resolve(handler(req, res)).catch(next);
        });
        await request(app).post('/defaults').expect(200, {pageSize: 20});
    });

    test.each([
        [undefined, {'user[name]': 'alice'}],
        [{limit: '10mb'}, {user: {name: 'alice'}}],
        [{extended: true}, {user: {name: 'alice'}}],
        [{extended: false}, {'user[name]': 'alice'}],
    ])('preserves URL-encoded parsing with config %j', async (config, body) => {
        const app = setupApp({expressBodyParserURLEncodedConfig: config});
        await request(app).post('/body').type('form').send('user[name]=alice').expect(200, {body});
    });

    test('parses raw bodies after the JSON and URL-encoded parsers skip them', async () => {
        const app = setupApp({expressBodyParserRawConfig: {type: 'application/octet-stream'}});
        await request(app)
            .post('/body')
            .type('application/octet-stream')
            .send(Buffer.from('raw'))
            .expect(200, {body: {type: 'Buffer', data: [114, 97, 119]}});
    });

    test('keeps malformed JSON and size-limit errors', async () => {
        const app = setupApp({expressBodyParserJSONConfig: {limit: 16}});
        await request(app)
            .post('/body')
            .type('json')
            .send('{')
            .expect(400, 'Invalid JSON supplied');
        await request(app)
            .post('/body')
            .send({value: 'too large for the configured limit'})
            .expect(413, 'Request entity too large');
    });

    test('retains the custom URL-encoded parameter limit', async () => {
        const app = setupApp({expressBodyParserURLEncodedConfig: {parameterLimit: 1}});
        const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
            res.status(error.status).json({type: error.type});
        };
        app.use(handleError);
        await request(app)
            .post('/body')
            .type('form')
            .send('a=1&b=2')
            .expect(413, {type: 'parameters.too.many'});
    });
});
