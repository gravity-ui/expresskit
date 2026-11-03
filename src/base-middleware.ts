import {randomUUID} from 'node:crypto';

import {type AppConfig, type AppContext, REQUEST_ID_PARAM_NAME} from '@gravity-ui/nodekit';
import type {Express, Request, Response} from 'express';

import {DEFAULT_REQUEST_ID_HEADER} from './constants';

interface LoggedHeaderNames {
    request?: Set<string>;
    response?: Set<string>;
    errorRequest?: Set<string>;
    errorResponse?: Set<string>;
}

interface FinishedRequestParams {
    req: Request;
    res: Response;
    requestId: string;
    responseTime: number;
    statusCode: string;
    isFailed: boolean;
}

function prepareHeaderNames(names?: string[]) {
    // an empty whitelist is meaningful: it omits every header
    if (!names) {
        return undefined;
    }

    return new Set(names.map((name) => name.toLowerCase()));
}

function resolveLoggedHeaderNames(config: AppConfig): LoggedHeaderNames {
    return {
        request: prepareHeaderNames(config.appLoggingRequestHeaders),
        response: prepareHeaderNames(config.appLoggingResponseHeaders),
        errorRequest: prepareHeaderNames(
            config.appLoggingErrorRequestHeaders ?? config.appLoggingRequestHeaders,
        ),
        errorResponse: prepareHeaderNames(
            config.appLoggingErrorResponseHeaders ?? config.appLoggingResponseHeaders,
        ),
    };
}

function pickLoggedHeaders<T extends object>(headers: T, names?: Set<string>): Partial<T> {
    if (!names) {
        return headers;
    }

    return Object.fromEntries(
        Object.entries(headers).filter(([name]) => names.has(name.toLowerCase())),
    ) as Partial<T>;
}

function buildRequestInfo(ctx: AppContext, req: Request, requestId: string, names?: Set<string>) {
    return {
        id: requestId,
        method: req.method,
        url: ctx.utils.redactSensitiveQueryParams(req.url),
        headers: ctx.utils.redactSensitiveHeaders(pickLoggedHeaders(req.headers, names)),
        remoteAddress: req.socket && req.socket.remoteAddress,
        remotePort: req.socket && req.socket.remotePort,
    };
}

function buildResponseInfo(
    ctx: AppContext,
    res: Response,
    responseTime: number,
    statusCode: string,
    names?: Set<string>,
) {
    return {
        responseTime,
        statusCode,
        // TODO: drop the redactSensitiveKeys pass in the next major,
        // appSensitiveHeaders should be the only option for response headers.
        // It is kept on top of the header redacter for backward compatibility:
        // before the switch to redactSensitiveHeaders response headers were
        // redacted by key, so appSensitiveKeys was the only working option
        headers: ctx.utils.redactSensitiveKeys(
            ctx.utils.redactSensitiveHeaders(pickLoggedHeaders(res.getHeaders(), names)),
        ),
    };
}

export function setupBaseMiddleware(ctx: AppContext, expressApp: Express) {
    const headerNames = resolveLoggedHeaderNames(ctx.config);

    const buildStartedExtra = (req: Request, requestId: string) =>
        ctx.config.appDevMode
            ? {req: {url: ctx.utils.redactSensitiveQueryParams(req.url)}}
            : {req: buildRequestInfo(ctx, req, requestId, headerNames.request)};

    const buildFinishedExtra = ({
        req,
        res,
        requestId,
        responseTime,
        statusCode,
        isFailed,
    }: FinishedRequestParams): Record<string, unknown> => {
        if (ctx.config.appDevMode) {
            return {res: {responseTime, statusCode}};
        }

        if (isFailed) {
            return {
                req: buildRequestInfo(ctx, req, requestId, headerNames.errorRequest),
                res: buildResponseInfo(
                    ctx,
                    res,
                    responseTime,
                    statusCode,
                    headerNames.errorResponse,
                ),
            };
        }

        return {
            res: buildResponseInfo(ctx, res, responseTime, statusCode, headerNames.response),
        };
    };

    const appendAppExtra = (
        extra: Record<string, unknown>,
        req: Request,
        res: Response,
    ): Record<string, unknown> => {
        const buildAppExtra = ctx.config.appLoggingResponseExtra;

        if (!buildAppExtra) {
            return extra;
        }

        try {
            return {...buildAppExtra(req, res), ...extra};
        } catch (error) {
            ctx.logError('Error preparing response log extra', error);
            return extra;
        }
    };

    expressApp.use((req, res, next) => {
        try {
            const requestIdHeaderName =
                ctx.config.expressRequestIdHeaderName || DEFAULT_REQUEST_ID_HEADER;
            const requestId = (req.headers[requestIdHeaderName] as string) || randomUUID();
            req.id = requestId;
            res.setHeader(requestIdHeaderName, requestId);

            const expressClientIpHeaderName = ctx.config.expressClientIpHeaderName?.toLowerCase();
            if (expressClientIpHeaderName) {
                const clientIp = req.headers[expressClientIpHeaderName] as string | undefined;
                Object.defineProperty(req, 'ip', {
                    value: clientIp,
                    writable: true,
                    configurable: true,
                });
            }

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

            const shouldLogRequest = ctx.config.appLoggingRequestFilter?.(req) ?? true;

            if (shouldLogRequest) {
                req.ctx.log('Request started', buildStartedExtra(req, requestId));
            }

            res.on('finish', () => {
                const statusCode = String(res.statusCode);
                const isFailed = statusCode.startsWith('5');

                req.originalContext.setTag('http.status_code', statusCode);

                if (!isFailed && !shouldLogRequest) {
                    return;
                }

                const extra = appendAppExtra(
                    buildFinishedExtra({
                        req,
                        res,
                        requestId,
                        responseTime: Date.now() - startTime,
                        statusCode,
                        isFailed,
                    }),
                    req,
                    res,
                );

                if (isFailed) {
                    req.originalContext.logError('Request failed', null, extra);
                } else {
                    req.originalContext.log('Request completed', extra);
                }
            });

            res.on('close', () => {
                setImmediate(() => {
                    if (!req.originalContext.abortSignal?.aborted) {
                        req.originalContext.end();
                    }
                });
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
