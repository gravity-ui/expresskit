import {ExpressKit, Request, Response} from '..';
import {AppConfig, NodeKit} from '@gravity-ui/nodekit';
import request from 'supertest';

const APP_NAME = 'app';

const setupApp = ({config}: {config?: AppConfig} = {}) => {
    const logger = {
        write: () => {},
    };

    const nodekit = new NodeKit({
        config: {
            appLoggingDestination: logger,
            appName: APP_NAME,
            ...config,
        },
    });

    const routes = {
        'GET /ip': {
            handler: (req: Request, res: Response) => {
                res.status(200);
                res.send({ip: req.ip});
            },
        },
    };

    const app = new ExpressKit(nodekit, routes);

    return {app, logger};
};

describe('expressClientIpHeaderName', () => {
    it('should use default req.ip when expressClientIpHeaderName is not set', async () => {
        const {app} = setupApp();

        const agent = request.agent(app.express);

        const response = await agent.get('/ip');

        expect(response.status).toBe(200);
        expect(response.body.ip).toBeDefined();
        // supertest uses ::ffff:127.0.0.1 for IPv6-mapped IPv4 addresses
        expect(response.body.ip).toMatch(/127\.0\.0\.1|::1|::ffff:127\.0\.0\.1/);
    });

    it('should override req.ip with value from custom header when expressClientIpHeaderName is set', async () => {
        const customIpHeader = 'X-Real-IP';
        const customIp = '203.0.113.42';

        const {app} = setupApp({
            config: {
                expressClientIpHeaderName: customIpHeader,
            },
        });

        const agent = request.agent(app.express);

        const response = await agent.get('/ip').set(customIpHeader, customIp);

        expect(response.status).toBe(200);
        expect(response.body.ip).toBe(customIp);
    });

    it('should be case-insensitive for header names', async () => {
        const customIpHeader = 'X-Real-IP';
        const customIp = '203.0.113.99';

        const {app} = setupApp({
            config: {
                expressClientIpHeaderName: customIpHeader,
            },
        });

        const agent = request.agent(app.express);

        const response = await agent.get('/ip').set('x-real-ip', customIp);

        expect(response.status).toBe(200);
        expect(response.body.ip).toBe(customIp);
    });

    it('should set req.ip to undefined when custom header is not present in request', async () => {
        const customIpHeader = 'X-Real-IP';

        const {app} = setupApp({
            config: {
                expressClientIpHeaderName: customIpHeader,
            },
        });

        const agent = request.agent(app.express);

        const response = await agent.get('/ip');

        expect(response.status).toBe(200);
        expect(response.body.ip).toBeUndefined();
    });
});
