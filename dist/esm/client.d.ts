import { ExtWSClient } from '@extws/server';
import { ServerWebSocket } from 'bun';
import { ServerData } from './types.js';
import { ExtWSBunServer } from './main.js';
export declare class ExtWSBunClient extends ExtWSClient {
    private bun_client;
    constructor(server: ExtWSBunServer, bun_client: ServerWebSocket<ServerData>);
    addToGroup(group_id: string): void;
    removeFromGroup(group_id: string): void;
    sendPayload(payload: string): void;
    disconnect(): void;
}
