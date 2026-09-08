import { ExtWS } from '@extws/server';
import type { ExtWSOnBeforeUpgradeHandler } from '@extws/server/dev';
import { IP } from '@kirick/ip';
import type { Server } from 'bun';
import { ExtWSBunClient } from './client.js';
import type { ServerData } from './types.js';

export class ExtWSBunServer extends ExtWS {
	private bun_server: Server<ServerData>;

	constructor({
		path = '/ws',
		port,
		...options_rest
	}: {
		path?: string;
		port: number;
		onBeforeUpgrade?: ExtWSOnBeforeUpgradeHandler;
	}) {
		super();

		const port_string = String(port);

		this.bun_server = Bun.serve<ServerData>({
			port,
			async fetch(request, server) {
				const url = new URL(request.url);
				url.protocol = 'ws:';
				url.host = request.headers.get('host') ?? '';
				url.port = port_string;

				if (url.pathname.startsWith(path)) {
					const { headers } = request;
					const ip = server.requestIP(request)?.address;

					if (!ip) {
						throw new Error('IP is not defined.');
					}

					try {
						const upgrade_response = await options_rest.onBeforeUpgrade?.({
							url,
							headers,
							ip: new IP(ip),
						});

						if (upgrade_response) {
							return upgrade_response;
						}

						server.upgrade(request, {
							data: {
								id: '',
								url,
								headers,
							} satisfies ServerData,
						});

						return;
					} catch (error) {
						// oxlint-disable-next-line no-console
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

	override publish(channel: string, payload: string): void {
		this.bun_server.publish(channel, payload);
	}

	// TODO: investigate why that call hangs
	// async close() {
	// 	await this.bun_server.stop();
	// }
}

export type { ExtWSBunClient } from './client.js';
