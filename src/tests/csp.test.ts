import {NodeKit} from '@gravity-ui/nodekit';
import request from 'supertest';

import {ExpressKit, csp} from '..';

describe('CSP middleware', () => {
    test('keeps default directives and generates a fresh nonce for each request', async () => {
        const nodekit = new NodeKit({config: {expressCspEnable: true}});
        const app = new ExpressKit(nodekit, {
            'GET /test': (req, res) => {
                res.json({nonce: req.nonce, localNonce: res.locals.nonce});
            },
        });

        const first = await request(app.express).get('/test').expect(200);
        const second = await request(app.express).get('/test').expect(200);

        expect(first.body.nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
        expect(first.body.localNonce).toBe(first.body.nonce);
        expect(second.body.nonce).not.toBe(first.body.nonce);
        expect(first.headers['content-security-policy']).toContain("default-src 'self';");
        expect(first.headers['content-security-policy']).toContain(
            `script-src 'self' 'nonce-${first.body.nonce}';`,
        );
        expect(first.headers['content-security-policy']).toContain("img-src 'self' data:;");
        expect(first.headers['content-security-policy-report-only']).toBeUndefined();
    });

    test('serializes conditional sources with the same CSP version as public presets', async () => {
        const nodekit = new NodeKit({
            config: {
                expressCspEnable: true,
                expressCspPresets: [{'script-src': [false, csp.values.SELF]}],
            },
        });
        const app = new ExpressKit(nodekit, {
            'GET /test': (_req, res) => res.send('ok'),
            'GET /override': {
                cspPresets: [{'script-src': [false, csp.values.NONE]}],
                handler: (_req, res) => res.send('ok'),
            },
        });

        const response = await request(app.express).get('/test').expect(200);
        const override = await request(app.express).get('/override').expect(200);

        expect(response.headers['content-security-policy']).toBe("script-src 'self';");
        expect(override.headers['content-security-policy']).toBe("script-src 'none';");
    });

    test('preserves report-only policies and dynamic reporting configuration', async () => {
        const reportGroup = {
            group: 'csp',
            max_age: 60,
            endpoints: [{url: 'https://reports.example.com/csp'}],
        };
        const nodekit = new NodeKit({
            config: {
                expressCspEnable: true,
                expressCspReportOnly: true,
                expressCspPresets: [{'default-src': [csp.values.SELF], 'report-to': 'csp'}],
                expressCspReportUri: (req) => `/reports${req.path}`,
                expressCspReportTo: () => [reportGroup],
            },
        });
        const app = new ExpressKit(nodekit, {
            'GET /test': (_req, res) => res.send('ok'),
        });

        const response = await request(app.express).get('/test').expect(200);

        expect(response.headers['content-security-policy']).toBeUndefined();
        expect(response.headers['content-security-policy-report-only']).toBe(
            "default-src 'self'; report-to csp; report-uri /reports/test;",
        );
        expect(JSON.parse(response.headers['report-to'])).toEqual(reportGroup);
    });
});
