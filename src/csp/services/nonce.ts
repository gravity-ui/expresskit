import {CSPDirectives, CSPValues} from '../constants';
import type {DirectivesOfType} from '../types';
import {makeCspObject} from '../utils';

export function nonceRules(
    sources: DirectivesOfType<(typeof CSPValues.NONCE)[]>[] = [CSPDirectives.SCRIPT],
) {
    return makeCspObject(sources, [CSPValues.NONCE]);
}
