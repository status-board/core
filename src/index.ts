import server from './server';
import logger from './logger';

interface Options {
    port: number;
}

export default function (options: Options | undefined): void {
    const config = options || { port: 3000 };

    server.listen(config.port);

    logger.log(`Server running on port ${config.port}`);
}
