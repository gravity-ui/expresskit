import type {AppContext} from '@gravity-ui/nodekit';
import {USER_LANGUAGE_PARAM_NAME} from '@gravity-ui/nodekit';

export const setLang = ({lang, ctx}: {lang: string; ctx: AppContext}) => {
    if (!ctx.config.allowedLangs || ctx.config.allowedLangs.includes(lang)) {
        ctx.set(USER_LANGUAGE_PARAM_NAME, lang);
        return true;
    }

    return false;
};
