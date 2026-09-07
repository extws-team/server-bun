import { ExtWS, ExtWSClient } from "@extws/server";
import { IP } from "@kirick/ip";

//#region src/client.ts
var ExtWSBunClient = class extends ExtWSClient {
	bun_client;
	constructor(server, bun_client) {
		super(server, bun_client.data.options);
		this.bun_client = bun_client;
	}
	ownsTransport(bun_client) {
		return this.bun_client === bun_client;
	}
	addToChannel(channel_id) {
		if (!this.bun_client.subscribe(channel_id)) throw new Error(`Failed to subscribe to channel "${channel_id}".`);
	}
	removeFromChannel(channel_id) {
		if (!this.bun_client.unsubscribe(channel_id)) throw new Error(`Failed to unsubscribe from channel "${channel_id}".`);
	}
	sendPayload(payload) {
		if (this.bun_client.send(payload) === 0) throw new Error("Failed to send WebSocket payload.");
	}
	closeTransport() {
		this.bun_client.close();
	}
};

//#endregion
//#region src/main.ts
/** Keeps the conditional data requirement at the upgrade boundary. */
async function getUpgradeContext(options, context) {
	const data = await options.onBeforeUpgrade?.(context);
	return data instanceof Response ? data : { options: {
		...context,
		data
	} };
}
var ExtWSBunServer = class extends ExtWS {
	bun_server;
	close_promise;
	constructor(options) {
		const { path = "/ws", port, healthcheck } = options;
		super({ healthcheck });
		this.bun_server = Bun.serve({
			port,
			fetch: async (request, server) => {
				if (this.close_promise) return new Response("", { status: 503 });
				const url = new URL(request.url);
				url.protocol = "ws:";
				url.host = request.headers.get("host") ?? "";
				url.port = String(server.port ?? port);
				if (url.pathname.startsWith(path)) {
					const { headers } = request;
					try {
						const ip = server.requestIP(request)?.address;
						if (!ip) throw new Error("IP is not defined.");
						const data = await getUpgradeContext(options, {
							url,
							headers,
							ip: new IP(ip)
						});
						if (this.close_promise) return new Response("", { status: 503 });
						if (data instanceof Response) return data;
						if (server.upgrade(request, { data })) return;
					} catch (error) {
						console.error(error);
					}
				}
				return new Response("", { status: 500 });
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
							if (client) client.disconnect();
							else bun_client.close();
						} catch (error$1) {
							reported_error = new AggregateError([reported_error, error$1], "Failed to open and clean up WebSocket client.");
						}
						console.error(registered ? "Connect listener failed." : "Client initialization failed.", reported_error);
					}
				},
				message: (bun_client, payload) => {
					const { client } = bun_client.data;
					if (!this.close_promise && client && client.server === this && client.ownsTransport(bun_client) && this.clients.get(client.id) === client) this.onMessage(client, payload);
				},
				close(bun_client) {
					const { client } = bun_client.data;
					delete bun_client.data.client;
					client?.transportClosed();
				}
			}
		});
	}
	publish(channel, payload) {
		this.bun_server.publish(channel, payload);
	}
	close() {
		this.close_promise ??= (async () => {
			await Promise.resolve();
			await this.closeServer();
		})();
		return this.close_promise;
	}
	async closeServer() {
		const errors = (await Promise.allSettled([(async () => {
			await super.close();
		})(), (async () => {
			await this.bun_server.stop(true);
		})()])).flatMap((result) => result.status === "rejected" ? [result.reason] : []);
		if (errors.length > 0) throw new AggregateError(errors, "Failed to close ExtWS Bun server.");
	}
};

//#endregion
export { ExtWSBunServer };