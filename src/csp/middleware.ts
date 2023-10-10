import {expressCspHeader} from 'express-csp-header';
import type {ExpressCSPParams} from 'express-csp-header';

import {getDefaultPresets} from './default-presets';

import type {CSPPreset} from '.';

export interface CSPMiddlewareParams extends Omit<ExpressCSPParams, 'presets'> {
    appPresets: CSPPreset;
    routPresets?:
        | CSPPreset
        | ((params: {
              getDefaultPresets: typeof getDefaultPresets;
              appPresets: CSPPreset;
          }) => CSPPreset);
}

export function cspMiddleware(options: CSPMiddlewareParams) {
    let presets: CSPPreset = options.appPresets;
    if (options.routPresets) {
        presets =
            typeof options.routPresets === 'function'
                ? options.routPresets({getDefaultPresets, appPresets: presets})
                : options.routPresets;
    }

    return expressCspHeader({...options, presets});
}

export function getAppPresets(
    presets?: CSPPreset | ((params: {getDefaultPresets: typeof getDefaultPresets}) => CSPPreset),
) {
    let appPresets: CSPPreset;
    if (presets) {
        appPresets = typeof presets === 'function' ? presets({getDefaultPresets}) : presets;
    } else {
        appPresets = getDefaultPresets();
    }

    return appPresets;
}
