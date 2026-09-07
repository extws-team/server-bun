import { ExtWS } from '@extws/server';
import type { ExtWSOnBeforeUpgradeHandler } from '@extws/server/dev';
import { IP } from '@kirick/ip';
import type { Server } from 'bun';
import { ExtWSBunClient } from './client.js';
import type { ServerData, ServerOptions } from './types.js';

function getUpgradeContext<ClientData>(
	options: ServerOptions<ClientData>,
	context: Parameters<ExtWSOnBeforeUpgradeHandler<ClientData>>[0],
): Promise<Response | ServerData<ClientData>>;
/** Keeps the conditional data requirement at the upgrade boundary. */
async function getUpgradeContext(
	options: { onBeforeUpgrade?: ExtWSOnBeforeUpgradeHandler<unknown> },
	context: Parameters<ExtWSOnBeforeUpgradeHandler<unknown>>[0],
): Promise<Response | ServerData<unknown>> {
	const data = await options.onBeforeUpgrade?.(context);
	return data instanceof Response ? data : { options: { ...context, data } };
}

export class ExtWSBunServer<ClientData = undefined> extends ExtWS<ClientData> {
	declare clients: Map<string, ExtWSBunClient<ClientData>>;
	private bun_server: Server<ServerData<ClientData>>;
	private close_promise?: Promise<void>;

	constructor(options: ServerOptions<ClientData>) {
		const { path = '/ws', port, healthcheck } = options;
		super({ healthcheck });

		this.bun_server = Bun.serve<ServerData<ClientData>>({
			port,
			fetch: async (request, server) => {
				if (this.close_promise) {
					return new Response('', { status: 503 });
				}

				const url = new URL(request.url);
				url.protocol = 'ws:';
				url.host = request.headers.get('host') ?? '';
				url.port = String(server.port ?? port);

				if (url.pathname.startsWith(path)) {
					const { headers } = request;
					try {
						const ip = server.requestIP(request)?.address;
						if (!ip) {
							throw new Error('IP is not defined.');
						}

						const data = await getUpgradeContext(options, {
							url,
							headers,
							ip: new IP(ip),
						});

						if (this.close_promise) {
							return new Response('', { status: 503 });
						}

						if (data instanceof Response) {
							return data;
						}

						if (server.upgrade(request, { data })) {
							return;
						}
					} catch (error) {
						// oxlint-disable-next-line no-console
						console.error(error);
					}
				}

				return new Response('', { status: 500 });
			},
			websocket: {
				idleTimeout: 0,
				open: (bun_client) => {
					try {
						if (this.close_promise) {
							bun_client.close();
							return;
						}

						const client = new ExtWSBunClient(this, bun_client);
						bun_client.data.client = client;
						this.onConnect(client);
					} catch (error) {
						let reported_error = error;
						const { client } = bun_client.data;
						const registered = client && this.clients.get(client.id) === client;
						delete bun_client.data.client;
						try {
							if (client) {
								client.disconnect();
							} else {
								bun_client.close();
							}
							// oxlint-disable-next-line no-shadow
						} catch (error) {
							reported_error = new AggregateError(
								[reported_error, error],
								'Failed to open and clean up WebSocket client.',
							);
						}

						// oxlint-disable-next-line no-console
						console.error(
							registered
								? 'Connect listener failed.'
								: 'Client initialization failed.',
							reported_error,
						);
					}
				},
				message: (bun_client, payload) => {
					const { client } = bun_client.data;

					if (
						!this.close_promise
						&& client
						&& client.server === this
						&& client.ownsTransport(bun_client)
						&& this.clients.get(client.id) === client
					) {
						this.onMessage(client, payload);
					}
				},
				close(bun_client) {
					const { client } = bun_client.data;
					delete bun_client.data.client;
					client?.transportClosed();
				},
			},
		});
	}

	override publish(channel: string, payload: string): void {
		this.bun_server.publish(channel, payload);
	}

	override close(): Promise<void> {
		// Cache before invoking cleanup, which may reenter close() via listeners.
		this.close_promise ??= (async () => {
			await Promise.resolve();
			await this.closeServer();
		})();

		return this.close_promise;
	}

	private async closeServer(): Promise<void> {
		const results = await Promise.allSettled([
			(async () => {
				await super.close();
			})(),
			(async () => {
				await this.bun_server.stop(true);
			})(),
		]);
		const errors = results.flatMap((result) =>
			result.status === 'rejected' ? [result.reason] : [],
		);
		if (errors.length > 0) {
			throw new AggregateError(errors, 'Failed to close ExtWS Bun server.');
		}
	}
}

export type { ExtWSBunClient } from './client.js';
