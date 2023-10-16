import type {CSPPresetsArray} from 'csp-header';

import {csp} from '.';

export function getDefaultPresets({defaultNone}: {defaultNone?: boolean} = {}) {
    const presets: CSPPresetsArray = [csp.self(), csp.nonce(), csp.data()];

    if (defaultNone) {
        presets.unshift(csp.none([csp.directives.DEFAULT]));
    } else {
        presets.unshift(csp.self([csp.directives.DEFAULT]));
    }

    return presets;
}
