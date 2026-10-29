import { ExtWSClient } from '@extws/server';
import { IP } from '@kirick/ip';
import type { ServerWebSocket } from 'bun';
import { ExtWSBunServer } from './main.js';
import type { ServerData } from './types.js';

export class ExtWSBunClient<
	TData extends Record<string, unknown> | undefined = undefined,
> extends ExtWSClient<TData> {
	private bun_client: ServerWebSocket<ServerData<TData>>;

	constructor(
		server: ExtWSBunServer<TData>,
		bun_client: ServerWebSocket<ServerData<TData>>,
	) {
		super(server, {
			url: bun_client.data.url,
			headers: bun_client.data.headers,
			ip: new IP(bun_client.remoteAddress),
			data: bun_client.data.data,
		});

		this.bun_client = bun_client;
	}

	/** @internal */
	addToChannel(channel_id: string): void {
		try {
			this.bun_client.subscribe(channel_id);
		} catch (error) {
			// oxlint-disable-next-line no-console
			console.error(error);
			this.disconnect();
		}
	}

	/** @internal */
	removeFromChannel(channel_id: string): void {
		try {
			this.bun_client.unsubscribe(channel_id);
		} catch (error) {
			// oxlint-disable-next-line no-console
			console.error(error);
			this.disconnect();
		}
	}

	/** @internal */
	sendPayload(payload: string): void {
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
