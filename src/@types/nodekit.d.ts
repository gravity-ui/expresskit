import type bodyParser from 'body-parser';
import type {ErrorRequestHandler, RequestHandler} from 'express';

import type {CSPPreset} from './csp';
import type {getDefaultPresets} from './csp/default-presets';
import type {CSPMiddlewareParams} from './csp/middleware';

declare module '@gravity-ui/nodekit' {
    interface AppConfig {
        expressTrustProxyNumber?: number | boolean;
        expressCookieSecret?: string | string[];
        expressRequestIdHeaderName?: string;

        expressDisableBodyParserJSON?: boolean;
        expressBodyParserJSONConfig?: bodyParser.OptionsJson;
        expressExtendedBodyParserJSONLimitError?: boolean;

        expressDisableBodyParserURLEncoded?: boolean;
        expressBodyParserURLEncodedConfig?: bodyParser.OptionsUrlencoded;

        expressBodyParserRawConfig?: bodyParser.Options;

        appPort?: number;
        appSocket?: string;

        appFinalErrorHandler?: ErrorRequestHandler;
        appAuthHandler?: RequestHandler;
        appAuthPolicy?: `${AuthPolicy}`;

        appBeforeAuthMiddleware?: RequestHandler[];
        appAfterAuthMiddleware?: RequestHandler[];

        appTelemetryChEnableSelfStats?: boolean;

        expressCspEnable?: boolean;
        expressCspPresets?:
            | CSPPreset
            | ((params: {getDefaultPresets: typeof getDefaultPresets}) => CSPPreset);
        expressCspReportOnly?: boolean;
        expressCspReportTo?: CSPMiddlewareParams['reportTo'];
        expressCspReportUri?: CSPMiddlewareParams['reportUri'];

        allowedLangs?: string[];
        defaultLang?: string;
        getLangByHostname?: (hostname: string) => string | undefined;
    }

    interface AppContext {
        langUtils: {
            setLang: (lang: string) => void;
        };
    }
}
