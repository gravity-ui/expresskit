import {CSPDirectives, CSPValues} from '../constants';
import type {DirectivesOfType} from '../types';
import {makeCspObject} from '../utils';

export function inlineRules(
    sources: DirectivesOfType<(typeof CSPValues.UNSAFE_INLINE)[]>[] = [
        CSPDirectives.SCRIPT,
        CSPDirectives.STYLE,
    ],
) {
    return makeCspObject(sources, [CSPValues.UNSAFE_INLINE]);
}
