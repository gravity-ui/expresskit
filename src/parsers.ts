import type {AppContext} from '@gravity-ui/nodekit';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import type {Express} from 'express';

import type {AppErrorHandler} from './types';

const DEFAULT_JSON_PARSER_CONFIG = {
    limit: '10mb',
};

const DEFAULT_URLENCODED_PARSER_CONFIG = {
    limit: '10mb',
    extended: false,
};

interface BodyLimitError extends Error {
    statusCode: number;
    limit: number;
    length: number;
}

function isBodyLimitError(err: Error): err is BodyLimitError {
    return 'limit' in err && 'length' in err;
}

export function setupParsers(ctx: AppContext, expressApp: Express) {
    expressApp.use(cookieParser(ctx.config.expressCookieSecret));

    if (!ctx.config.expressDisableBodyParserJSON) {
        expressApp.use(
            bodyParser.json(ctx.config.expressBodyParserJSONConfig || DEFAULT_JSON_PARSER_CONFIG),
        );

        const jsonParsingErrorHandler: AppErrorHandler = (error, _, res, next) => {
            if (error instanceof SyntaxError && error.statusCode === 400 && 'body' in error) {
                res.status(400).send('Invalid JSON supplied');
            } else if (error?.statusCode === 413) {
                const errorMessage = 'Request entity too large';
                if (ctx.config.expressExtendedBodyParserJSONLimitError && isBodyLimitError(error)) {
                    res.status(413).send({
                        message: errorMessage,
                        limit: error.limit,
                        length: error.length,
                    });
                } else {
                    res.status(413).send(errorMessage);
                }
            } else {
                next();
                return;
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        expressApp.use(jsonParsingErrorHandler);
    }

    if (!ctx.config.expressDisableBodyParserURLEncoded) {
        expressApp.use(
            bodyParser.urlencoded(
                ctx.config.expressBodyParserURLEncodedConfig || DEFAULT_URLENCODED_PARSER_CONFIG,
            ),
        );
    }

    if (ctx.config.expressBodyParserRawConfig) {
        expressApp.use(bodyParser.raw(ctx.config.expressBodyParserRawConfig));
    }
}
