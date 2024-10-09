import {AppContext} from '@gravity-ui/nodekit';
import acceptLanguage from 'accept-language-parser';
import type {Express} from 'express';

const LANG_BY_TLD: Record<string, string | undefined> = {
    ru: 'ru',
    com: 'en',
};

export function setupLangMiddleware(ctx: AppContext, expressApp: Express) {
    const config = ctx.config;
    const {defaultLang, allowedLangs} = config;
    if (allowedLangs && allowedLangs.length > 0 && defaultLang) {
        expressApp.use((req, _res, next) => {
            req.ctx.utils.setLang(defaultLang);

            if (config.getLangByHostname) {
                const langByHostname = config.getLangByHostname(req.hostname);

                if (langByHostname) {
                    req.ctx.utils.setLang(langByHostname);
                }
            } else {
                const tld = req.hostname.split('.').pop();
                const langByTld = tld ? LANG_BY_TLD[tld] : undefined;

                if (langByTld) {
                    req.ctx.utils.setLang(langByTld);
                }
            }

            if (req.headers['accept-language']) {
                const langByHeader = acceptLanguage.pick(
                    allowedLangs,
                    req.headers['accept-language'],
                    {loose: true},
                );

                if (langByHeader) {
                    req.ctx.utils.setLang(langByHeader);
                }
            }

            return next();
        });
    }
}
