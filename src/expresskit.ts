import fs from 'fs';

import express, {Express} from 'express';
import type {AppConfig, NodeKit} from '@gravity-ui/nodekit';
import type {AppRoutes} from './types';
import type {Server} from 'http';
import {setupRoutes} from './router';
import {setupBaseMiddleware} from './base-middleware';
import {setupParsers} from './parsers';

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
    }

    run() {
        const appSocket = process.env.APP_SOCKET || this.config.appSocket;
        const listenTarget =
            process.env.APP_PORT || this.config.appPort || appSocket || DEFAULT_PORT;
        const listenTargetType = appSocket === listenTarget ? 'socket' : 'port';

        this.nodekit.ctx.log(`Listening on ${listenTargetType} ${listenTarget}`);

        if (appSocket && listenTargetType === 'socket' && fs.existsSync(appSocket)) {
            fs.unlinkSync(appSocket);
        }

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
}
