import { ExtWS } from '@extws/server';
import type {
	ExtWSOnBeforeUpgradeOptions,
	ExtWSOptions,
} from '@extws/server/dev';
import { IP } from '@kirick/ip';
import type { Serve, Server, WebSocketHandler } from 'bun';
import { ExtWSBunClient } from './client.js';
import type { ServerData } from './types.js';

export class ExtWSBunServer<
	TData extends Record<string, unknown> | undefined = undefined,
> extends ExtWS<TData> {
	private bun_server: Server<ServerData<TData>>;

	constructor({
		path = '/ws',
		port,
		bun,
		idleTimeout,
		pingTimeout,
		...options_rest
	}: {
		path?: string;
		port: number;
		/**
		 * Options of the underlying `Bun.serve()` server and its WebSocket handler.
		 * @see https://bun.com/docs/runtime/http/websockets
		 */
		bun?: Pick<Serve.HostnamePortServeOptions<unknown>, 'reusePort'> &
			Pick<
				WebSocketHandler<unknown>,
				| 'backpressureLimit'
				| 'closeOnBackpressureLimit'
				| 'maxPayloadLength'
				| 'perMessageDeflate'
			>;
	} & ExtWSOptions &
		ExtWSOnBeforeUpgradeOptions<TData>) {
		super({ idleTimeout, pingTimeout });

		this.bun_server = Bun.serve<ServerData<TData>>({
			port,
			reusePort: bun?.reusePort,
			async fetch(request, server) {
				// Bun builds the URL from the Host header
				const url = new URL(request.url);
				url.protocol = 'ws:';

				if (url.pathname !== path) {
					return new Response('', { status: 404 });
				}

				// do not run the hook for requests that cannot be upgraded anyway
				if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
					return new Response('', {
						status: 426,
						headers: {
							upgrade: 'websocket',
						},
					});
				}

				const { headers } = request;
				const ip = server.requestIP(request)?.address;

				if (!ip) {
					throw new Error('IP is not defined.');
				}

				try {
					const upgrade_result = await options_rest.onBeforeUpgrade?.({
						url,
						headers,
						ip: new IP(ip),
					});

					if (upgrade_result instanceof Response) {
						return upgrade_result;
					}

					const is_upgraded = server.upgrade(request, {
						data: {
							id: '',
							url,
							headers,
							// undefined only gets here when TData allows it, otherwise the hook is required and cannot return it
							data: upgrade_result as TData,
						} satisfies ServerData<TData>,
					});

					if (is_upgraded) {
						return;
					}

					return new Response('', { status: 400 });
				} catch (error) {
					// oxlint-disable-next-line no-console
					console.error(error);
				}

				return new Response('', { status: 500 });
			},
			websocket: {
				backpressureLimit: bun?.backpressureLimit,
				closeOnBackpressureLimit: bun?.closeOnBackpressureLimit,
				// silent clients are disconnected by the ExtWS watchdog
				idleTimeout: 0,
				maxPayloadLength: bun?.maxPayloadLength,
				perMessageDeflate: bun?.perMessageDeflate,
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

	/** @internal */
	publish(channel: string, payload: string): void {
		this.bun_server.publish(channel, payload);
	}

	override async close(): Promise<void> {
		// without closing active connections, `stop()` waits for every client to leave
		await this.bun_server.stop(true);
		await super.close();
	}
}

export type { ExtWSBunClient } from './client.js';
