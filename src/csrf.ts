import {AppContext, USER_ID_PARAM_NAME} from '@gravity-ui/nodekit';
import crypto from 'crypto';
import {NextFunction, Request, Response} from './types';

const MONTH_SECONDS = 30 * 24 * 60 * 60;

function getUnixTime() {
    return Math.floor(Number(new Date()) / 1000);
}

export function prepareCSRFMiddleware(ctx: AppContext) {
    const {
        appCsrfSecret: secret,
        appCsrfLifetime: lifetime = MONTH_SECONDS,
        appCsrfHeaderName: headerName = 'x-csrf-token',
        appCsrfCookieName: cookieName = 'CSRF-TOKEN',
        appCsrfMethods: methods = ['POST', 'PUT', 'DELETE', 'PATCH'],
    } = ctx.config;

    if (!secret) {
        throw new Error('Misconfigured application: CSRF secret key should be specified');
    }

    const csrfSecrets = Array.isArray(secret) ? secret : [secret];

    function buildToken(userId: string, timestamp = getUnixTime(), csrfSecret = csrfSecrets[0]) {
        try {
            const hmac = crypto.createHmac('sha1', csrfSecret);
            const message = `${userId}:${timestamp}`;

            const digest = hmac.update(message).digest('hex');
            return `${digest}:${timestamp}`;
        } catch (error) {
            throw new Error('Failed to build CSRF token');
        }
    }

    function checkToken(userId: string, timestamp = getUnixTime(), tokenValue: string) {
        for (let i = 0; i < csrfSecrets.length; i += 1) {
            if (buildToken(userId, timestamp, csrfSecrets[i]) === tokenValue) {
                return true;
            }
        }
        return false;
    }

    function validate(userId: string, tokenValue: string | undefined) {
        if (!tokenValue) {
            throw new Error('CSRF token is missing');
        }
        const timestamp = parseInt(tokenValue.split(':')[1], 10);
        if (lifetime > 0 && timestamp + lifetime <= getUnixTime()) {
            throw new Error('CSRF token is out of date');
        }
        if (checkToken(userId, timestamp, tokenValue) === false) {
            throw new Error('CSRF token is not valid');
        }
        return true;
    }

    return function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
        const userId = req.ctx.get(USER_ID_PARAM_NAME);

        if (!userId) {
            throw new Error('CSRF protection is enabled but user ID is not found');
        }

        const csrfToken = buildToken(userId);

        res.locals.csrfToken = csrfToken;
        res.cookie(cookieName, csrfToken, {
            secure: true,
            sameSite: true,
            maxAge: lifetime * 1000,
        });
        res.set(headerName, csrfToken);

        const isCsrfDisabled = Boolean(req.routeInfo?.disableCsrf);
        const nonApplicableAuthMethod = Boolean(res.locals.oauth); // TODO we should move to something like res.locals.skipCsrf instead of this

        const shouldCheckToken =
            !isCsrfDisabled && methods.includes(req.method) && !nonApplicableAuthMethod;

        if (shouldCheckToken) {
            const headerValue =
                req.headers[headerName] ||
                req.headers['x-csrf-token'] ||
                req.headers['x-xsrf-token'];
            const tokenValue =
                headerValue && Array.isArray(headerValue) ? headerValue[0] : headerValue;

            try {
                validate(userId, tokenValue);
            } catch (error) {
                req.ctx.logError('CSRF_ERROR', error);
                res.status(419).send({
                    error: error instanceof Error && error.message,
                });
                return;
            }
        }

        next();
    };
}
