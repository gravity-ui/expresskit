import {type AppContext, REQUEST_ID_PARAM_NAME} from '@gravity-ui/nodekit';
import type {Express} from 'express';
import {v4 as uuidv4} from 'uuid';

import {DEFAULT_REQUEST_ID_HEADER} from './constants';

export function setupBaseMiddleware(ctx: AppContext, expressApp: Express) {
    expressApp.use((req, res, next) => {
        try {
            const requestIdHeaderName =
                ctx.config.expressRequestIdHeaderName || DEFAULT_REQUEST_ID_HEADER;
            const requestId = (req.headers[requestIdHeaderName] as string) || uuidv4();
            req.id = requestId;
            res.setHeader(requestIdHeaderName, requestId);

            req.routeInfo = {};

            const startTime = Date.now();

            const userAgent = req.get('user-agent') ?? 'unknown';
            const parentSpanContext = ctx.extractSpanContext(req.headers);

            req.originalContext = req.ctx = ctx.create(`Express ${req.method}`, {
                parentSpanContext,
                loggerPostfix: ctx.config.appLoggingOmitIdInMessages ? '' : `[${requestId}]`,
                spanKind: 1, // SERVER
            });
            req.ctx.set(REQUEST_ID_PARAM_NAME, requestId);

            req.ctx.setTag('http.hostname', req.hostname);
            req.ctx.setTag('http.method', req.method);
            req.ctx.setTag('http.url', ctx.utils.redactSensitiveQueryParams(req.url));
            req.ctx.setTag('path', ctx.utils.redactSensitiveQueryParams(req.path));
            req.ctx.setTag('referer', ctx.utils.redactSensitiveQueryParams(req.get('referer')));
            req.ctx.setTag('remote_ip', req.ip ?? 'unknown');
            req.ctx.setTag('request_id', requestId);
            req.ctx.setTag('user_agent', userAgent);

            const traceId = req.ctx.getTraceId();
            if (traceId) {
                res.setHeader('x-trace-id', traceId);
            }

            req.ctx.addLoggerExtra('req', {
                id: requestId,
                method: req.method,
                url: ctx.utils.redactSensitiveQueryParams(req.path),
            });

            const requestStartedExtra = ctx.config.appDevMode
                ? {req: {url: ctx.utils.redactSensitiveQueryParams(req.url)}}
                : {
                      req: {
                          id: requestId,
                          method: req.method,
                          url: ctx.utils.redactSensitiveQueryParams(req.url),
                          headers: ctx.utils.redactSensitiveHeaders(req.headers),
                          remoteAddress: req.socket && req.socket.remoteAddress,
                          remotePort: req.socket && req.socket.remotePort,
                      },
                  };
            req.ctx.log('Request started', requestStartedExtra);

            res.on('finish', () => {
                const statusCode = String(res.statusCode);
                const responseTime = Date.now() - startTime;

                const responseExtra = ctx.config.appDevMode
                    ? {res: {responseTime, statusCode}}
                    : {
                          res: {
                              responseTime,
                              statusCode,
                              headers: ctx.utils.redactSensitiveKeys(res.getHeaders()),
                          },
                      };

                if (statusCode.startsWith('5')) {
                    req.originalContext.logError('Request failed', null, responseExtra);
                } else {
                    req.originalContext.log('Request completed', responseExtra);
                }
                req.originalContext.setTag('http.status_code', statusCode);
            });

            next();
            return;
        } catch (error) {
            ctx.logError('Error during request setup', error);
            if (req.ctx) {
                req.ctx.setTag('error', true);
                req.ctx.end();
            }
            res.status(500).send('Internal server error');
        }
    });
}
