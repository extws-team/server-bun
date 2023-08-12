
import ExtWSDriver from '@extws/server/driver'; // eslint-disable-line import/no-unresolved, import/extensions
import IP          from '@kirick/ip';

import ExtWSBunClient from './client.js';

const path_regexp = new RegExp(/^\/ws(\/|$)/);

export default class ExtWSBunDriver extends ExtWSDriver {
	#bun_server;

	constructor ({
		path = '/ws',
		port,
		payload_max_length,
	}) {
		super();

		this.#bun_server = Bun.serve(
			{
				development: true, // TODO: убрать перед загрузкой в npm
				port,
				fetch(request, server) {
					console.dir(request);

					const url = new URL(request.url);

					if (true === path_regexp.test(url.pathname)) {
						server.upgrade(request, {
							data: {
								url: new URL(
									url.pathname + url.search,
									'ws://' + request.headers.get("host"),
								),
								headers: request.headers,
							},
						}); 		
					}
				},
				websocket: {
					open: (bun_client) => {
						const client = new ExtWSBunClient(
							bun_client,
							this,
							{
								url: bun_client.data.url,
								headers: bun_client.data.headers,
								// TODO: ip-address
								ip: new IP(bun_client.remoteAddress),
							}
						);

						bun_client._extws_client_id = client.id;

						this.onConnect(client);
					},
					message: (bun_client, payload) => {
						const client = this.clients.get(
							bun_client._extws_client_id
						);
						
						if (client) {
							if (typeof payload !== 'string' && Buffer.isBuffer(payload) !== true) {
								payload = Buffer.from(payload);
							}

							this.onMessage(
								client,
								payload,
							);
						}
					},
					close: (bun_client) => {
						const client = this.clients.get(
							bun_client._extws_client_id
						);

						if (client) {
							client.disconnect(
								true, // is_already_disconnected
							);
						}
					}, 
				},
			}
		);
	}

	publish (channel, payload) {
		this._bun_server.publish(
			channel,
			payload,
		);
	}
}