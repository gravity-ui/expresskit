import {AppContext} from '@gravity-ui/nodekit';
import acceptLanguage from 'accept-language-parser';
import type {Express} from 'express';
import {setLang} from './set-lang';

const LANG_BY_TLD: Record<string, string | undefined> = {
    ru: 'ru',
    com: 'en',
};

export function setupLangMiddleware(ctx: AppContext, expressApp: Express) {
    const config = ctx.config;
    const {defaultLang, allowedLangs} = config;
    if (allowedLangs && allowedLangs.length > 0 && defaultLang) {
        expressApp.use((req, res, next) => {
            setLang({lang: defaultLang, config, res: res});

            if (config.getLangByHostname) {
                const langByHostname = config.getLangByHostname(req.hostname);

                if (langByHostname) {
                    setLang({lang: langByHostname, config, res: res});
                }
            } else {
                const tld = req.hostname.split('.').pop();
                const langByTld = tld ? LANG_BY_TLD[tld] : undefined;

                if (langByTld) {
                    setLang({lang: langByTld, config, res: res});
                }
            }

            if (req.headers['accept-language']) {
                const langByHeader = acceptLanguage.pick(
                    allowedLangs,
                    req.headers['accept-language'],
                    {loose: true},
                );

                if (langByHeader) {
                    setLang({lang: langByHeader, config, res: res});
                }
            }

            return next();
        });
    }
}
