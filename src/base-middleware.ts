import {Express} from 'express';
import {v4 as uuidv4} from 'uuid';
import {AppContext} from '@gravity-ui/nodekit';
import {DEFAULT_REQUEST_ID_HEADER} from './constants';

export function setBaseMiddleware(ctx: AppContext, expressApp: Express) {
    expressApp.use((req, res, next) => {
        try {
            req.id = (req.headers[DEFAULT_REQUEST_ID_HEADER] || uuidv4()) as string;
            res.setHeader(DEFAULT_REQUEST_ID_HEADER, req.id);

            res.setHeader('Surrogate-Control', 'no-store');
            res.setHeader(
                'Cache-Control',
                'no-store, max-age=0, must-revalidate, proxy-revalidate',
            );

            req.routeInfo = {};

            const startTime = Date.now();

            const userAgent = req.get('user-agent');
            const parentSpanContext = ctx.extractSpanContext(req.headers);

            req.originalContext = req.ctx = ctx.create(`Express ${req.method}`, {
                parentSpanContext,
                loggerPostfix: `[${req.id}]`,
            });
            req.ctx.set('requestId', req.id);

            req.ctx.setTag('http.hostname', req.hostname);
            req.ctx.setTag('http.method', req.method);
            req.ctx.setTag('http.url', req.url);
            req.ctx.setTag('path', req.path);
            req.ctx.setTag('referer', req.get('referer'));
            req.ctx.setTag('remote_ip', req.ip);
            req.ctx.setTag('request_id', req.id);
            req.ctx.setTag('user_agent', userAgent);

            const requestStartedExtra = ctx.config.appDevMode
                ? {url: req.url}
                : {
                      id: req.id,
                      method: req.method,
                      url: req.url,
                      headers: ctx.utils.redactSensitiveKeys(req.headers),
                      remoteAddress: req.connection && req.connection.remoteAddress,
                      remotePort: req.connection && req.connection.remotePort,
                  };
            req.ctx.log('Request started', requestStartedExtra);

            res.on('finish', () => {
                const statusCode = String(res.statusCode);
                const responseTime = Date.now() - startTime;

                const responseExtra = ctx.config.appDevMode
                    ? {responseTime, statusCode}
                    : {
                          responseTime,
                          statusCode,
                          headers: ctx.utils.redactSensitiveKeys(res.getHeaders()),
                      };

                if (statusCode.startsWith('5')) {
                    req.originalContext.logError('Request failed', null, responseExtra);
                } else {
                    req.originalContext.log('Request completed', responseExtra);
                }
                req.originalContext.setTag('http.status_code', statusCode);
                req.originalContext.end();
            });

            const traceId = req.ctx.getTraceId();
            if (traceId) {
                res.setHeader('x-trace-id', traceId);
            }

            next();
            return;
        } catch (error) {
            ctx.logError('Error during server setup', error);
            if (req.ctx) {
                req.ctx.setTag('error', true);
                req.ctx.end();
            }
            res.status(500).send('Internal server error');
        }
    });
}
