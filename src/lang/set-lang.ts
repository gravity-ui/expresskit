import type {AppContext} from '@gravity-ui/nodekit';
import type {Response} from '../';
export const prepareSetLang = (ctx: AppContext, res: Response) => {
    return (lang: string) => {
        if (!ctx.config.allowedLangs || ctx.config.allowedLangs.includes(lang)) {
            res.locals.lang = lang;
            return true;
        }

        return false;
    };
};
