import type {AppConfig} from '@gravity-ui/nodekit';
import type {Response} from '../';

export const setLang = ({lang, config, res}: {lang: string; config: AppConfig; res: Response}) => {
    if (!config.allowedLangs || config.allowedLangs.includes(lang)) {
        res.locals.lang = lang;
        return true;
    }

    return false;
};
