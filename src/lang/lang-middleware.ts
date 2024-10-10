import {AppContext} from '@gravity-ui/nodekit';
import acceptLanguage from 'accept-language-parser';
import type {Express} from 'express';
import {setLang} from './set-lang';

const LANG_BY_TLD: Record<string, string | undefined> = {
    ru: 'ru',
    com: 'en',
};

export function setupLangMiddleware(appCtx: AppContext, expressApp: Express) {
    const config = appCtx.config;
    const {defaultLang, allowedLangs} = config;
    if (allowedLangs && allowedLangs.length > 0 && defaultLang) {
        expressApp.use((req, _res, next) => {
            setLang({lang: defaultLang, ctx: req.ctx});

            if (config.getLangByHostname) {
                const langByHostname = config.getLangByHostname(req.hostname);

                if (langByHostname) {
                    setLang({lang: langByHostname, ctx: req.ctx});
                }
            } else {
                const tld = req.hostname.split('.').pop();
                const langByTld = tld ? LANG_BY_TLD[tld] : undefined;

                if (langByTld) {
                    setLang({lang: langByTld, ctx: req.ctx});
                }
            }

            if (req.headers['accept-language']) {
                const langByHeader = acceptLanguage.pick(
                    allowedLangs,
                    req.headers['accept-language'],
                    {loose: true},
                );

                if (langByHeader) {
                    setLang({lang: langByHeader, ctx: req.ctx});
                }
            }

            return next();
        });
    }
}
