import type {AppContext} from '@gravity-ui/nodekit';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import type {Express} from 'express';

import type {AppErrorHandler} from './types';

export function setupParsers(ctx: AppContext, expressApp: Express) {
    expressApp.use(cookieParser(ctx.config.expressCookieSecret));

    if (!ctx.config.expressDisableBodyParserJSON) {
        expressApp.use(bodyParser.json(ctx.config.expressBodyParserJSONConfig));

        const jsonParsingErrorHandler: AppErrorHandler = (error, _, res, __) => {
            if (error instanceof SyntaxError && error.statusCode === 400 && 'body' in error) {
                res.status(400).send('Invalid JSON supplied');
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        expressApp.use(jsonParsingErrorHandler);
    }

    if (!ctx.config.expressDisableBodyParserURLEncoded) {
        expressApp.use(
            bodyParser.urlencoded(ctx.config.expressBodyParserURLEncodedConfig || {extended: true}),
        );
    }

    if (ctx.config.expressBodyParserRawConfig) {
        expressApp.use(bodyParser.raw(ctx.config.expressBodyParserRawConfig));
    }
}
