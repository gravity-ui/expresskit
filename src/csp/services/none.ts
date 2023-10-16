import {CSPDirectives, CSPValues} from '../constants';
import type {DirectivesOfType} from '../types';
import {makeCspObject} from '../utils';

export function noneRules(
    sources: DirectivesOfType<(typeof CSPValues.NONE)[]>[] = [CSPDirectives.DEFAULT],
) {
    return makeCspObject(sources, [CSPValues.NONE]);
}
