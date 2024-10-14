import type {AppContext} from '@gravity-ui/nodekit';
import {USER_LANGUAGE_PARAM_NAME} from '@gravity-ui/nodekit';

export const setLang = ({lang, ctx}: {lang: string; ctx: AppContext}) => {
    const languageConfig = ctx.config.language || {};
    if (!languageConfig.allowLanguages || languageConfig.allowLanguages.includes(lang)) {
        ctx.set(USER_LANGUAGE_PARAM_NAME, lang);
        return true;
    }

    return false;
};
