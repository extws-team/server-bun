import { ExtWS } from '@extws/server';
import { ExtWSBunClient } from './client.js';
export class ExtWSBunServer extends ExtWS {
    bun_server;
    constructor({ path = '/ws', port, }) {
        super();
        const port_string = String(port);
        this.bun_server = Bun.serve({
            port,
            fetch(request, server) {
                const url = new URL(request.url);
                url.protocol = 'ws:';
                url.host = request.headers.get('host') ?? '';
                url.port = port_string;
                if (url.pathname.startsWith(path)) {
                    server.upgrade(request, {
                        data: {
                            url,
                            headers: request.headers,
                        },
                    });
                    return;
                }
                return new Response('Upgrade failed', { status: 500 });
            },
            websocket: {
                open: (bun_client) => {
                    const client = new ExtWSBunClient(this, bun_client);
                    bun_client.data.extws_client_id = client.id;
                    this.onConnect(client);
                },
                message: (bun_client, payload) => {
                    const client = this.clients.get(bun_client.data.extws_client_id);
                    if (client) {
                        this.onMessage(client, payload);
                    }
                },
                close: (bun_client) => {
                    const client = this.clients.get(bun_client.data.extws_client_id);
                    if (client) {
                        client.disconnect();
                    }
                },
            },
        });
    }
    publish(channel, payload) {
        this.bun_server.publish(channel, payload);
    }
    async close() {
        await this.bun_server.stop();
    }
}
