import { ExtWS } from '@extws/server';
export declare class ExtWSBunServer extends ExtWS {
    private bun_server;
    constructor({ path, port, }: {
        path?: string;
        port: number;
    });
    publish(channel: string, payload: string): void;
    close(): Promise<void>;
}
