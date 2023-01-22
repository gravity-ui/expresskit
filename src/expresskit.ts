import express, {Express} from 'express';
import {AppConfig, NodeKit} from '@gravity-ui/nodekit';
import {AppRoutes} from './types';
import {Server} from 'http';
import {setRoutes} from './router';
import {setBaseMiddleware} from './base-middleware';

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

        setBaseMiddleware(nodekit.ctx, this.express);
        setRoutes(this.nodekit.ctx, this.express, routes);
    }

    run() {
        const listenTarget =
            process.env.APP_PORT ||
            this.config.appPort ||
            process.env.APP_SOCKET ||
            this.config.appSocket ||
            DEFAULT_PORT;

        this.nodekit.ctx.log(`Listening on ${listenTarget}`);

        this.httpServer = this.express.listen(listenTarget, () => {
            this.nodekit.ctx.log('App is running');
        });

        this.nodekit.addShutdownHandler(() => {
            return new Promise((resolve, reject) => {
                this.httpServer?.close?.((error) => (error ? reject(error) : resolve));
            });
        });
    }
}
