import {AppContext} from '@gravity-ui/nodekit';
import acceptLanguage from 'accept-language-parser';
import type {Express} from 'express';
import {setLang} from './set-lang';

export function setupLangMiddleware(appCtx: AppContext, expressApp: Express) {
    const config = appCtx.config;

    const {defaultLang, allowedLangs, langQueryParamName} = config;
    if (!(allowedLangs && allowedLangs.length > 0 && defaultLang)) {
        return;
    }
    expressApp.use((req, _res, next) => {
        const langQuery = langQueryParamName && req.query[langQueryParamName];
        if (langQuery && typeof langQuery === 'string' && allowedLangs.includes(langQuery)) {
            setLang({lang: langQuery, ctx: req.ctx});
            return next();
        }

        setLang({lang: defaultLang, ctx: req.ctx});

        if (config.getLangByHostname) {
            const langByHostname = config.getLangByHostname(req.hostname);

            if (langByHostname) {
                setLang({lang: langByHostname, ctx: req.ctx});
            }
        } else {
            const tld = req.hostname.split('.').pop();
            const langByTld = tld && config.langByTld ? config.langByTld[tld] : undefined;

            if (langByTld) {
                setLang({lang: langByTld, ctx: req.ctx});
            }
        }

        if (req.headers['accept-language']) {
            const langByHeader = acceptLanguage.pick(allowedLangs, req.headers['accept-language'], {
                loose: true,
            });

            if (langByHeader) {
                setLang({lang: langByHeader, ctx: req.ctx});
            }
        }

        return next();
    });
}
