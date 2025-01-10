import { ExtWSClient, } from '@extws/server';
import { IP } from '@kirick/ip';
export class ExtWSBunClient extends ExtWSClient {
    bun_client;
    constructor(server, bun_client) {
        super(server, {
            url: bun_client.data.url,
            headers: bun_client.data.headers,
            ip: new IP(bun_client.remoteAddress),
        });
        this.bun_client = bun_client;
    }
    addToGroup(group_id) {
        try {
            this.bun_client.subscribe(group_id);
        }
        catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            this.disconnect();
        }
    }
    removeFromGroup(group_id) {
        try {
            this.bun_client.unsubscribe(group_id);
        }
        catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            this.disconnect();
        }
    }
    sendPayload(payload) {
        try {
            this.bun_client.send(payload);
        }
        catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            this.disconnect();
        }
    }
    disconnect() {
        try {
            this.bun_client.close();
        }
        catch { }
        super.disconnect();
    }
}
