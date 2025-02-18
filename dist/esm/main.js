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
    // eslint-disable-next-line max-lines-per-function
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
                    try {
                        const upgrade_response = await this.options?.onBeforeUpgrade?.({
                            url,
                            headers,
                            ip: new IP(ip),
                        });
                        if (upgrade_response) {
                            const response_headers = new Headers();
                            if (upgrade_response.headers) {
                                // eslint-disable-next-line max-depth
                                for (const [key, value] of Object.entries(upgrade_response.headers)) {
                                    // eslint-disable-next-line max-depth
                                    if (value !== undefined) {
                                        response_headers.set(key, value);
                                    }
                                }
                            }
                            return new Response(upgrade_response.body ?? '', {
                                status: upgrade_response.status,
                                headers: response_headers,
                            });
                        }
                        server.upgrade(request, {
                            data: {
                                id: '',
                                url,
                                headers,
                            },
                        });
                        return;
                    }
                    catch (error) {
                        // eslint-disable-next-line no-console
                        console.error(error);
                    }
                }
                return new Response('', { status: 500 });
            },
            websocket: {
                open: (bun_client) => {
                    const client = new ExtWSBunClient(this, bun_client);
                    bun_client.data.id = client.id;
                    this.onConnect(client);
                },
                message: (bun_client, payload) => {
                    const client = this.clients.get(bun_client.data.id);
                    if (client) {
                        this.onMessage(client, payload);
                    }
                },
                close: (bun_client) => {
                    const client = this.clients.get(bun_client.data.id);
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
