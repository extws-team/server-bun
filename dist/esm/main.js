import { ExtWS } from '@extws/server';
import { IP } from '@kirick/ip';
import { ExtWSBunClient } from './client.js';
/**
 * Convert `Headers` object to `Map`.
 * @param headers Headers object.
 * @returns Map of headers.
 */
function headersToMap(headers) {
    return new Map(Object.entries(headers.toJSON()));
}
export class ExtWSBunServer extends ExtWS {
    bun_server;
    constructor({ path = '/ws', port, ...options_rest }) {
        super(options_rest);
        const port_string = String(port);
        this.bun_server = Bun.serve({
            port,
            fetch: async (request, server) => {
                const url = new URL(request.url);
                url.protocol = 'ws:';
                url.host = request.headers.get('host') ?? '';
                url.port = port_string;
                if (url.pathname.startsWith(path)) {
                    const headers = headersToMap(request.headers);
                    const ip = server.requestIP(request)?.address;
                    if (!ip) {
                        throw new Error('IP is not defined.');
                    }
                    const upgrade_response = await this.options?.onBeforeUpgrade?.({
                        url,
                        headers,
                        ip: new IP(ip),
                    });
                    if (upgrade_response) {
                        return new Response(upgrade_response.body ?? '', {
                            status: upgrade_response.status,
                            headers: upgrade_response.headers
                                ? new Headers([
                                    ...upgrade_response.headers.entries(),
                                ])
                                : undefined,
                        });
                    }
                    server.upgrade(request, {
                        data: {
                            extws_client_id: '',
                            url,
                            headers,
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
}
