import {CSPDirectives, CSPValues} from '../constants';
import type {DirectivesOfType} from '../types';
import {makeCspObject} from '../utils';

export function evalRules(
    sources: DirectivesOfType<(typeof CSPValues.UNSAFE_EVAL)[]>[] = [CSPDirectives.SCRIPT],
) {
    return makeCspObject(sources, [CSPValues.UNSAFE_EVAL]);
}
