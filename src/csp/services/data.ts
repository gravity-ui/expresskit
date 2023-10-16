import {CSPDirectives, CSPValues} from '../constants';
import type {DirectivesOfType} from '../types';
import {makeCspObject} from '../utils';

export function dataRules(
    sources: DirectivesOfType<(typeof CSPValues.DATA)[]>[] = [CSPDirectives.IMG, 'trusted-types'],
) {
    return makeCspObject(sources, [CSPValues.DATA]);
}
