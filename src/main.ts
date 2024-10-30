import { ExtWS, OutcomePayloadEventType } from '@extws/server';
import { ExtWSBunClient } from './client.js';
import { Server } from 'bun';
import { ServerData } from './types.js';

export class ExtWSBunServer extends ExtWS {
	private bun_server: Server;

	constructor({
		path = '/ws',
		port,
		// payload_max_length,
	}: {
		path?: string,
		port: number,
	}) {
		super();

		const port_string = String(port);

		this.bun_server = Bun.serve<ServerData>(
			{
				port,
				// perMessageDeflate: true,
				fetch(request, server) {
					const url = new URL(request.url);
					url.protocol = 'ws:';
					url.host = request.headers.get('host') ?? '';
					url.port = port_string;

					if (url.pathname.startsWith(path)) {
						server.upgrade(
							request,
							{
								data: {
									url,
									headers: request.headers,
								},
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

		this.on<GroupPayload>(
			OutcomePayloadEventType.GROUP,
			(event) => {
				this.publish(
					`g-${event.group_id}`, // TODO: импортировать префикс
					event.payload,
				);
			}
		);

		this.on<BroadcastPayload>(
			OutcomePayloadEventType.BROADCAST,
			(event) => {
				this.publish(
					'broadcast', // TODO: импортировать имя группы
					event.payload,
				);
			}
		);
	}

	publish(channel: string, payload: string) {
		this.bun_server.publish(
			channel,
			payload,
		);
	}
}

interface BroadcastPayload extends Event {
	payload: string;
}

interface GroupPayload extends Event {
	group_id: string;
	payload: string;
}
