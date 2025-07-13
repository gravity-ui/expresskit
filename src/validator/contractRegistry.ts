import type {AppRouteHandler} from '../types';
import type {RouteContract} from './types';

const contractRegistry = new WeakMap<AppRouteHandler, RouteContract>();

export function registerContract(handler: AppRouteHandler, contract: RouteContract): void {
    contractRegistry.set(handler, contract);
}

export function getContract(handler: AppRouteHandler): RouteContract | undefined {
    return contractRegistry.get(handler);
}

export function getRouteContract(handler: AppRouteHandler): RouteContract | undefined {
    return getContract(handler);
}
