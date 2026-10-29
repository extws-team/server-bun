Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let _extws_server = require("@extws/server");
let _kirick_ip = require("@kirick/ip");
// src/client.ts
var ExtWSBunClient = class extends _extws_server.ExtWSClient {
	bun_client;
	constructor(server, bun_client) {
		super(server, {
			url: bun_client.data.url,
			headers: bun_client.data.headers,
			ip: new _kirick_ip.IP(bun_client.remoteAddress),
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
var ExtWSBunServer = class extends _extws_server.ExtWS {
	bun_server;
	constructor({ path = "/ws", port, ...options_rest }) {
		super();
		const port_string = String(port);
		this.bun_server = Bun.serve({
			port,
			async fetch(request, server) {
				const url = new URL(request.url);
				url.protocol = "ws:";
				url.host = request.headers.get("host") ?? "";
				url.port = port_string;
				if (url.pathname.startsWith(path)) {
					const { headers } = request;
					const ip = server.requestIP(request)?.address;
					if (!ip) throw new Error("IP is not defined.");
					try {
						const upgrade_result = await options_rest.onBeforeUpgrade?.({
							url,
							headers,
							ip: new _kirick_ip.IP(ip)
						});
						if (upgrade_result instanceof Response) return upgrade_result;
						server.upgrade(request, { data: {
							id: "",
							url,
							headers,
							data: upgrade_result
						} });
						return;
					} catch (error) {
						console.error(error);
					}
				}
				return new Response("", { status: 500 });
			},
			websocket: {
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
};
exports.ExtWSBunServer = ExtWSBunServer;
