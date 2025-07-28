import type {AppErrorHandler, AppRouteHandler} from '../types';
import type {ErrorContract, RouteContract} from './types';

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

const errorContractRegistry = new WeakMap<AppErrorHandler, ErrorContract>();

export function registerErrorContract(handler: AppErrorHandler, contract: ErrorContract): void {
    errorContractRegistry.set(handler, contract);
}

export function getErrorContract(handler: AppErrorHandler): ErrorContract | undefined {
    return errorContractRegistry.get(handler);
}
