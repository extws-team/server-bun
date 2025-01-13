import { ExtWSClient } from '@extws/server';
import { ServerWebSocket } from 'bun';
import { ServerData } from './types.js';
import { ExtWSBunServer } from './main.js';
export declare class ExtWSBunClient extends ExtWSClient {
    private bun_client;
    constructor(server: ExtWSBunServer, bun_client: ServerWebSocket<ServerData>);
    protected addToGroup(group_id: string): void;
    protected removeFromGroup(group_id: string): void;
    protected sendPayload(payload: string): void;
    disconnect(): void;
}
