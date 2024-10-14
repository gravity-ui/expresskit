import {AppContext} from '@gravity-ui/nodekit';
import acceptLanguage from 'accept-language-parser';
import type {Express} from 'express';
import {setLang} from './set-lang';

export function setupLangMiddleware(appCtx: AppContext, expressApp: Express) {
    const config = appCtx.config;
    const languageConfig = config.language;
    if (!languageConfig) {
        return;
    }

    const {defaultLang, allowLanguages, langQueryParamName} = languageConfig;
    if (allowLanguages && allowLanguages.length > 0 && defaultLang) {
        expressApp.use((req, _res, next) => {
            setLang({lang: defaultLang, ctx: req.ctx});

            if (languageConfig.getLangByHostname) {
                const langByHostname = languageConfig.getLangByHostname(req.hostname);

                if (langByHostname) {
                    setLang({lang: langByHostname, ctx: req.ctx});
                }
            } else {
                const tld = req.hostname.split('.').pop();
                const langByTld =
                    tld && languageConfig.langByTld ? languageConfig.langByTld[tld] : undefined;

                if (langByTld) {
                    setLang({lang: langByTld, ctx: req.ctx});
                }
            }

            if (req.headers['accept-language']) {
                const langByHeader = acceptLanguage.pick(
                    allowLanguages,
                    req.headers['accept-language'],
                    {loose: true},
                );

                if (langByHeader) {
                    setLang({lang: langByHeader, ctx: req.ctx});
                }
            }

            const langQuery = langQueryParamName && req.query[langQueryParamName];
            if (langQuery && typeof langQuery === 'string' && allowLanguages.includes(langQuery)) {
                setLang({lang: langQuery, ctx: req.ctx});
            }

            return next();
        });
    }
}
