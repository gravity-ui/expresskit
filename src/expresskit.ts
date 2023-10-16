import cluster from 'cluster';
import fs from 'fs';
import type {Server} from 'http';
import {isMainThread} from 'worker_threads';

import type {AppConfig, NodeKit} from '@gravity-ui/nodekit';
import express, {Express} from 'express';

import {setupBaseMiddleware} from './base-middleware';
import {setupParsers} from './parsers';
import {setupRoutes} from './router';
import type {AppRoutes} from './types';

const DEFAULT_PORT = 3030;

export class ExpressKit {
    nodekit: NodeKit;
    config: AppConfig;
    express: Express;
    httpServer?: Server;

    constructor(nodekit: NodeKit, routes: AppRoutes) {
        this.nodekit = nodekit;
        this.config = nodekit.config;

        this.express = express();

        this.express.disable('x-powered-by');
        this.express.disable('etag');

        // https://expressjs.com/en/guide/behind-proxies.html
        this.express.set('trust proxy', this.config.expressTrustProxyNumber ?? true);

        this.express.get('/__version', (_, res) => res.send({version: this.config.appVersion}));

        setupBaseMiddleware(this.nodekit.ctx, this.express);
        setupParsers(this.nodekit.ctx, this.express);
        setupRoutes(this.nodekit.ctx, this.express, routes);

        const appSocket = this.getAppSocket();
        const listenTarget = this.getListenTarget(appSocket);
        if (
            appSocket &&
            listenTarget === appSocket &&
            cluster.isPrimary &&
            isMainThread &&
            fs.existsSync(appSocket)
        ) {
            fs.unlinkSync(appSocket);
        }
    }

    run() {
        const appSocket = this.getAppSocket();
        const listenTarget = this.getListenTarget(appSocket);
        const listenTargetType = appSocket === listenTarget ? 'socket' : 'port';

        this.nodekit.ctx.log(`Listening on ${listenTargetType} ${listenTarget}`);

        this.httpServer = this.express.listen(listenTarget, () => {
            this.nodekit.ctx.log('App is running');
            if (listenTarget === appSocket) {
                fs.chmod(appSocket, 0o666, (error) => {
                    if (error instanceof Error) {
                        this.nodekit.ctx.logError('Socket manipulation error', error);
                        process.exit(1);
                    }
                });
            }
        });

        this.nodekit.addShutdownHandler(() => {
            return new Promise<void>((resolve, reject) => {
                this.httpServer?.close?.((error) => (error ? reject(error) : resolve()));
            });
        });
    }

    private getAppSocket = () => process.env.APP_SOCKET || this.config.appSocket;
    private getListenTarget = (appSocket?: string) =>
        process.env.APP_PORT || this.config.appPort || appSocket || DEFAULT_PORT;
}
