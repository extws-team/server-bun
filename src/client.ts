import { ExtWSClient } from '@extws/server';
import type { ServerWebSocket } from 'bun';
import type { ExtWSBunServer } from './main.js';
import type { ServerData } from './types.js';

export class ExtWSBunClient<
	ClientData = undefined,
> extends ExtWSClient<ClientData> {
	private bun_client: ServerWebSocket<ServerData<ClientData>>;

	constructor(
		server: ExtWSBunServer<ClientData>,
		bun_client: ServerWebSocket<ServerData<ClientData>>,
	) {
		super(server, bun_client.data.options);

		this.bun_client = bun_client;
	}

	ownsTransport(bun_client: ServerWebSocket<ServerData<ClientData>>): boolean {
		return this.bun_client === bun_client;
	}

	protected override addToChannel(channel_id: string): void {
		if (!this.bun_client.subscribe(channel_id)) {
			throw new Error(`Failed to subscribe to channel "${channel_id}".`);
		}
	}

	protected override removeFromChannel(channel_id: string): void {
		if (!this.bun_client.unsubscribe(channel_id)) {
			throw new Error(`Failed to unsubscribe from channel "${channel_id}".`);
		}
	}

	protected override sendPayload(payload: string): void {
		// -1 means queued under backpressure; only 0 is a send failure.
		if (this.bun_client.send(payload) === 0) {
			throw new Error('Failed to send WebSocket payload.');
		}
	}

	protected override closeTransport(): void {
		this.bun_client.close();
	}
}
