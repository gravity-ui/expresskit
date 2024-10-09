import {CSPDirectiveName} from 'csp-header';

import type {CommonTypeOfDirectives} from './types';

export function makeCspObject<T extends CSPDirectiveName>(
    sources: T[],
    data: CommonTypeOfDirectives<T>,
) {
    return sources.reduce(
        (acc, key) => {
            acc[key] = data;
            return acc;
        },
        {} as Record<T, CommonTypeOfDirectives<T>>,
    );
}
