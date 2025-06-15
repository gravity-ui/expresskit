import {ExpressKit, Request, Response} from '..';
import {NodeKit, USER_LANGUAGE_PARAM_NAME} from '@gravity-ui/nodekit';
import request from 'supertest';

const setupApp = (langConfig: NodeKit['config'] = {}) => {
    const nodekit = new NodeKit({
        config: {
            appDefaultLang: 'ru',
            appAllowedLangs: ['ru', 'en'],
            appLoggingDestination: {
                write: () => {},
            },
            ...langConfig,
        },
    });
    const routes = {
        'GET /test': {
            handler: (req: Request, res: Response) => {
                res.status(200);
                const lang = req.ctx.get(USER_LANGUAGE_PARAM_NAME);
                res.send({lang});
            },
        },
    };

    const app = new ExpressKit(nodekit, routes);

    return app;
};

describe('langMiddleware with default options', () => {
    it('should set default lang if no hostname or accept-language header', async () => {
        const app = setupApp();
        const res = await request.agent(app.express).get('/test');

        expect(res.text).toBe('{"lang":"ru"}');
        expect(res.status).toBe(200);
    });

    it('should set lang for en domains by tld', async () => {
        const app = setupApp({appLangByTld: {com: 'en', ru: 'ru'}});
        const res = await request.agent(app.express).host('www.foo.com').get('/test');

        expect(res.text).toBe('{"lang":"en"}');
        expect(res.status).toBe(200);
    });

    it('should set lang for ru domains by tld ', async () => {
        const app = setupApp({appLangByTld: {com: 'en', ru: 'ru'}});
        const res = await request.agent(app.express).host('www.foo.ru').get('/test');

        expect(res.text).toBe('{"lang":"ru"}');
        expect(res.status).toBe(200);
    });

    it('should set default lang for other domains by tld ', async () => {
        const app = setupApp({appLangByTld: {com: 'en', ru: 'ru'}});
        const res = await request.agent(app.express).host('www.foo.jp').get('/test');

        expect(res.text).toBe('{"lang":"ru"}');
        expect(res.status).toBe(200);
    });
});

describe('langMiddleware with getLangByHostname is set', () => {
    it('should set lang by known hostname if getLangByHostname is set', async () => {
        const app = setupApp({
            appGetLangByHostname: (hostname) => (hostname === 'www.foo.com' ? 'en' : undefined),
        });
        const res = await request.agent(app.express).host('www.foo.com').get('/test');

        expect(res.text).toBe('{"lang":"en"}');
        expect(res.status).toBe(200);
    });
    it("shouldn't set default lang for unknown hostname if getLangByHostname is set", async () => {
        const app = setupApp({
            appGetLangByHostname: (hostname) => (hostname === 'www.foo.com' ? 'en' : undefined),
        });
        const res = await request.agent(app.express).host('www.bar.com').get('/test');

        expect(res.text).toBe('{"lang":"ru"}');
        expect(res.status).toBe(200);
    });
});

describe('langMiddleware with accept-language header', () => {
    it('should set lang if known accept-language', async () => {
        const app = setupApp({
            appGetLangByHostname: (hostname) => (hostname === 'www.foo.com' ? 'en' : undefined),
        });
        const res = await request
            .agent(app.express)
            .host('www.foo.com')
            .set('accept-language', 'ru-RU, ru;q=0.9, en-US;q=0.8, en;q=0.7, fr;q=0.6')
            .get('/test');

        expect(res.text).toBe('{"lang":"ru"}');
        expect(res.status).toBe(200);
    });
    it('should set tld lang for unknown accept-language', async () => {
        const app = setupApp({
            appGetLangByHostname: (hostname) => (hostname === 'www.foo.com' ? 'en' : undefined),
        });
        const res = await request
            .agent(app.express)
            .host('www.foo.com')
            .set('accept-language', 'fr;q=0.6')
            .get('/test');

        expect(res.text).toBe('{"lang":"en"}');
        expect(res.status).toBe(200);
    });
});

describe('langMiddleware with lang query param', () => {
    it('should set lang if known accept-language', async () => {
        const app = setupApp({
            appLangQueryParamName: '_lang',
        });
        const res = await request
            .agent(app.express)
            .host('www.foo.com')
            .set('accept-language', 'ru-RU, ru;q=0.9, en-US;q=0.8, en;q=0.7, fr;q=0.6')
            .get('/test?_lang=en');

        expect(res.text).toBe('{"lang":"en"}');
        expect(res.status).toBe(200);
    });
});
