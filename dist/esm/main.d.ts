import { ExtWS } from '@extws/server';
import { type ExtWSOnBeforeUpgradeHandler } from '@extws/server/dev';
export declare class ExtWSBunServer extends ExtWS {
    private bun_server;
    constructor({ path, port, ...options_rest }: {
        path?: string;
        port: number;
        onBeforeUpgrade?: ExtWSOnBeforeUpgradeHandler;
    });
    publish(channel: string, payload: string): void;
}
