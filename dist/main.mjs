import { ExtWS, ExtWSClient } from "@extws/server";
import { IP } from "@kirick/ip";
// src/client.ts
var ExtWSBunClient = class extends ExtWSClient {
	bun_client;
	constructor(server, bun_client) {
		super(server, {
			url: bun_client.data.url,
			headers: bun_client.data.headers,
			ip: new IP(bun_client.remoteAddress),
			data: bun_client.data.data
		});
		this.bun_client = bun_client;
	}
	/** @internal */
	addToChannel(channel_id) {
		try {
			this.bun_client.subscribe(channel_id);
		} catch (error) {
			console.error(error);
			this.disconnect();
		}
	}
	/** @internal */
	removeFromChannel(channel_id) {
		try {
			this.bun_client.unsubscribe(channel_id);
		} catch (error) {
			console.error(error);
			this.disconnect();
		}
	}
	/** @internal */
	sendPayload(payload) {
		try {
			this.bun_client.send(payload);
		} catch (error) {
			console.error(error);
			this.disconnect();
		}
	}
	disconnect() {
		try {
			this.bun_client.close();
		} catch {}
		super.disconnect();
	}
};
// src/main.ts
var ExtWSBunServer = class extends ExtWS {
	bun_server;
	constructor({ path = "/ws", port, bun, idleTimeout, pingTimeout, ...options_rest }) {
		super({
			idleTimeout,
			pingTimeout
		});
		this.bun_server = Bun.serve({
			port,
			reusePort: bun?.reusePort,
			async fetch(request, server) {
				const url = new URL(request.url);
				url.protocol = "ws:";
				if (url.pathname !== path) return new Response("", { status: 404 });
				if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response("", {
					status: 426,
					headers: { upgrade: "websocket" }
				});
				const { headers } = request;
				const ip = server.requestIP(request)?.address;
				if (!ip) throw new Error("IP is not defined.");
				try {
					const upgrade_result = await options_rest.onBeforeUpgrade?.({
						url,
						headers,
						ip: new IP(ip)
					});
					if (upgrade_result instanceof Response) return upgrade_result;
					if (server.upgrade(request, { data: {
						id: "",
						url,
						headers,
						data: upgrade_result
					} })) return;
					return new Response("", { status: 400 });
				} catch (error) {
					console.error(error);
				}
				return new Response("", { status: 500 });
			},
			websocket: {
				backpressureLimit: bun?.backpressureLimit,
				closeOnBackpressureLimit: bun?.closeOnBackpressureLimit,
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
					if (client) this.onMessage(client, payload);
				},
				close: (bun_client) => {
					const client = this.clients.get(bun_client.data.id);
					if (client) client.disconnect();
				}
			}
		});
	}
	/** @internal */
	publish(channel, payload) {
		this.bun_server.publish(channel, payload);
	}
	async close() {
		await this.bun_server.stop(true);
		await super.close();
	}
};
export { ExtWSBunServer };
