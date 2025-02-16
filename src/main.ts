import { ExtWS } from '@extws/server';
import { type ExtWSOnBeforeUpgradeHandler } from '@extws/server/dev';
import { ExtWSBunClient } from './client.js';
import { Server } from 'bun';
import { ServerData } from './types.js';

/**
 * Convert `Headers` object to `Map`.
 * @param headers Headers object.
 * @returns Map of headers.
 */
function headersToMap(headers: Headers) {
	return new Map<string, string>(
		Object.entries(
			headers.toJSON(),
		),
	);
}

export class ExtWSBunServer extends ExtWS {
	private bun_server: Server;

	constructor({
		path = '/ws',
		port,
		...options_rest
	}: {
		path?: string,
		port: number,
		onBeforeUpgrade?: ExtWSOnBeforeUpgradeHandler,
	}) {
		super(options_rest);

		const port_string = String(port);

		this.bun_server = Bun.serve<ServerData>(
			{
				port,
				fetch: async (request, server) => {
					const url = new URL(request.url);
					url.protocol = 'ws:';
					url.host = request.headers.get('host') ?? '';
					url.port = port_string;

					if (url.pathname.startsWith(path)) {
						const headers = headersToMap(request.headers);
						const upgrade_response = await this.options?.onBeforeUpgrade?.(url, headers);
						if (upgrade_response) {
							return new Response(
								upgrade_response.body ?? '',
								{
									status: upgrade_response.status,
									headers: upgrade_response.headers
										? new Headers([
											...upgrade_response.headers.entries(),
										])
										: undefined,
								},
							);
						}

						server.upgrade(
							request,
							{
								data: {
									extws_client_id: '',
									url,
									headers,
								} satisfies ServerData,
							},
						);

						return;
					}

					return new Response(
						'Upgrade failed',
						{ status: 500 },
					);
				},
				websocket: {
					open: (bun_client) => {
						const client = new ExtWSBunClient(
							this,
							bun_client,
						);

						bun_client.data.extws_client_id = client.id;

						this.onConnect(client);
					},
					message: (bun_client, payload) => {
						const client = this.clients.get(
							bun_client.data.extws_client_id,
						);

						if (client) {
							this.onMessage(
								client,
								payload,
							);
						}
					},
					close: (bun_client) => {
						const client = this.clients.get(
							bun_client.data.extws_client_id,
						);

						if (client) {
							client.disconnect();
						}
					},
				},
			},
		);
	}

	publish(channel: string, payload: string) {
		this.bun_server.publish(
			channel,
			payload,
		);
	}

	// TODO: investigate why that call hangs
	// async close() {
	// 	await this.bun_server.stop();
	// }
}
