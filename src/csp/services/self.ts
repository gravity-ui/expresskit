import {CSPDirectives, CSPValues} from '../constants';
import type {DirectivesOfType} from '../types';
import {makeCspObject} from '../utils';

export function selfRules(
    sources: DirectivesOfType<(typeof CSPValues.SELF)[]>[] = [
        CSPDirectives.SCRIPT,
        CSPDirectives.STYLE,
        CSPDirectives.FONT,
        CSPDirectives.IMG,
        CSPDirectives.MEDIA,
        CSPDirectives.FRAME,
        CSPDirectives.CHILD,
        CSPDirectives.CONNECT,
    ],
) {
    return makeCspObject(sources, [CSPValues.SELF]);
}
