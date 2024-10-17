import {AppContext} from '@gravity-ui/nodekit';
import acceptLanguage from 'accept-language-parser';
import type {Express} from 'express';
import {setLang} from './set-lang';

export function setupLangMiddleware(appCtx: AppContext, expressApp: Express) {
    const config = appCtx.config;

    const {appDefaultLang, appAllowedLangs, appLangQueryParamName} = config;
    if (!(appAllowedLangs && appAllowedLangs.length > 0 && appDefaultLang)) {
        return;
    }
    expressApp.use((req, _res, next) => {
        const langQuery = appLangQueryParamName && req.query[appLangQueryParamName];
        if (langQuery && typeof langQuery === 'string' && appAllowedLangs.includes(langQuery)) {
            setLang({lang: langQuery, ctx: req.ctx});
            return next();
        }

        setLang({lang: appDefaultLang, ctx: req.ctx});

        if (config.appGetLangByHostname) {
            const langByHostname = config.appGetLangByHostname(req.hostname);

            if (langByHostname) {
                setLang({lang: langByHostname, ctx: req.ctx});
            }
        } else {
            const tld = req.hostname.split('.').pop();
            const langByTld = tld && config.appLangByTld ? config.appLangByTld[tld] : undefined;

            if (langByTld) {
                setLang({lang: langByTld, ctx: req.ctx});
            }
        }

        if (req.headers['accept-language']) {
            const langByHeader = acceptLanguage.pick(
                appAllowedLangs,
                req.headers['accept-language'],
                {
                    loose: true,
                },
            );

            if (langByHeader) {
                setLang({lang: langByHeader, ctx: req.ctx});
            }
        }

        return next();
    });
}
