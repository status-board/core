import Koa from 'koa';
import cors from '@koa/cors';
import serve from 'koa-static';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import SocketIO, { Socket } from 'socket.io';
import Router, { RouterContext } from 'koa-router';

import Bus, { Subscription } from './bus';
import CoreApi from './core-api';
import logger from './logger';

const baseDir = process.cwd();
const localBuildFilePath = path.join(baseDir, 'build');
const localConfigFilePath = path.join(baseDir, 'config', 'config');

export function readConfigIfExists(fileName: string): any {
    let configFileName = fileName;

    if (!path.extname(configFileName)) {
        configFileName = `${configFileName}.js`;
    }

    if (fs.existsSync(configFileName)) {
        return require(configFileName);
    }

    return {};
}

const config = readConfigIfExists(localConfigFilePath);
const app = new Koa();
const router = new Router();
router.get('/config', (ctx: RouterContext): void => {
    ctx.body = config;
});
app.use(router.routes());
app.use(router.allowedMethods());

const bus = new Bus({ logger });
const server = http.createServer(app.callback());
const socket = SocketIO(server, { serveClient: false });

app.use(cors());

logger.info(`serving static contents from ${localBuildFilePath}`);
app.use(serve(localBuildFilePath));


bus.registerApi('Status-Board', CoreApi(bus));

socket.on('error', (error: Error): void => {
    logger.error(error.message, error);
});

socket.on('connection', (client: Socket): void => {
    bus.addClient(client);

    client.on('api.subscription', (subscription: Subscription): void => {
        bus.subscribe(client.id, subscription);
    });

    client.on('api.unsubscription', (subscription: Subscription): void => {
        bus.unsubscribe(client.id, subscription.id);
    });

    client.on('disconnect', (): void => {
        bus.removeClient(client.id);
    });
});

export default server;
