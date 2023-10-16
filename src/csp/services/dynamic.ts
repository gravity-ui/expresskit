import {CSPDirectives, CSPValues} from '../constants';
import type {DirectivesOfType} from '../types';
import {makeCspObject} from '../utils';

export function dynamicRules(
    sources: DirectivesOfType<(typeof CSPValues.STRICT_DYNAMIC)[]>[] = [CSPDirectives.SCRIPT],
) {
    return makeCspObject(sources, [CSPValues.STRICT_DYNAMIC]);
}
