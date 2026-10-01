import { ExtWSClient } from '@extws/server';
import { IP } from '@kirick/ip';
import type { ExtWSBunServer } from './main.js';
import type { ServerData } from './types.js';

export class ExtWSBunClient<
	ClientData = undefined,
> extends ExtWSClient<ClientData> {
	private bun_client: Bun.ServerWebSocket<ServerData<ClientData>>;

	constructor(
		server: ExtWSBunServer<ClientData>,
		bun_client: Bun.ServerWebSocket<ServerData<ClientData>>,
	) {
		super(server, {
			url: bun_client.data.url,
			headers: bun_client.data.headers,
			ip: new IP(bun_client.remoteAddress),
			data: bun_client.data.data,
		} as ConstructorParameters<typeof ExtWSClient<ClientData>>[1]);

		this.bun_client = bun_client;
	}

	/** @internal */
	override _addToChannel(channel_id: string): void {
		try {
			this.bun_client.subscribe(channel_id);
		} catch (error) {
			// oxlint-disable-next-line no-console
			console.error(error);
			this.disconnect();
		}
	}

	/** @internal */
	override _removeFromChannel(channel_id: string): void {
		try {
			this.bun_client.unsubscribe(channel_id);
		} catch (error) {
			// oxlint-disable-next-line no-console
			console.error(error);
			this.disconnect();
		}
	}

	/** @internal */
	override _sendPayload(payload: string): void {
		try {
			this.bun_client.send(payload);
		} catch (error) {
			// oxlint-disable-next-line no-console
			console.error(error);
			this.disconnect();
		}
	}

	override disconnect(): void {
		try {
			this.bun_client.close();
		} catch {}

		super.disconnect();
	}
}
