import type {CSPDirectives} from 'csp-header';

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
    ? I
    : never;

export type DirectivesOfType<T> = {
    [K in keyof CSPDirectives]: T extends CSPDirectives[K] ? K : never;
}[keyof CSPDirectives];

export type CommonTypeOfDirectives<T> = UnionToIntersection<
    T extends keyof CSPDirectives ? {Type: CSPDirectives[T]} : never
> extends Record<string, infer P>
    ? P
    : never;
