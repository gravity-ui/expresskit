import type {CSPPresetsArray} from 'csp-header';

import {CSPDirectives, CSPValues} from './constants';
import {dataRules} from './services/data';
import {dynamicRules} from './services/dynamic';
import {evalRules} from './services/eval';
import {inlineRules} from './services/inline';
import {nonceRules} from './services/nonce';
import {noneRules} from './services/none';
import {selfRules} from './services/self';
import {makeCspObject} from './utils';

export type CSPPreset = CSPPresetsArray;

export const csp = {
    directives: CSPDirectives,
    values: CSPValues,

    none: noneRules,
    self: selfRules,
    inline: inlineRules,
    eval: evalRules,
    nonce: nonceRules,
    data: dataRules,
    dynamic: dynamicRules,

    makeCspObject,
};
