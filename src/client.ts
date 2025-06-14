import { ExtWSClient } from '@extws/server';
import type { ServerWebSocket } from 'bun';
import type { ServerData } from './types.js';
import { ExtWSBunServer } from './main.js';
import { IP } from '@kirick/ip';

export class ExtWSBunClient extends ExtWSClient {
	private bun_client: ServerWebSocket<ServerData>;

	constructor(
		server: ExtWSBunServer,
		bun_client: ServerWebSocket<ServerData>,
	) {
		super(
			server,
			{
				url: bun_client.data.url,
				headers: bun_client.data.headers,
				ip: new IP(bun_client.remoteAddress),
			},
		);

		this.bun_client = bun_client;
	}

	protected override addToChannel(channel_id: string): void {
		try {
			this.bun_client.subscribe(channel_id);
		}
		catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			this.disconnect();
		}
	}

	protected override removeFromChannel(channel_id: string): void {
		try {
			this.bun_client.unsubscribe(channel_id);
		}
		catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			this.disconnect();
		}
	}

	protected override sendPayload(payload: string): void {
		try {
			this.bun_client.send(payload);
		}
		catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			this.disconnect();
		}
	}

	override disconnect(): void {
		try {
			this.bun_client.close();
		}
		catch {}

		super.disconnect();
	}
}
