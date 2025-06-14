import { ExtWS, ExtWSClient } from "@extws/server";
import { IP } from "@kirick/ip";

//#region src/client.ts
var ExtWSBunClient = class extends ExtWSClient {
	bun_client;
	constructor(server, bun_client) {
		super(server, {
			url: bun_client.data.url,
			headers: bun_client.data.headers,
			ip: new IP(bun_client.remoteAddress)
		});
		this.bun_client = bun_client;
	}
	addToChannel(channel_id) {
		try {
			this.bun_client.subscribe(channel_id);
		} catch (error) {
			console.error(error);
			this.disconnect();
		}
	}
	removeFromChannel(channel_id) {
		try {
			this.bun_client.unsubscribe(channel_id);
		} catch (error) {
			console.error(error);
			this.disconnect();
		}
	}
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

//#endregion
//#region src/main.ts
var ExtWSBunServer = class extends ExtWS {
	bun_server;
	constructor({ path = "/ws", port,...options_rest }) {
		super(options_rest);
		const port_string = String(port);
		this.bun_server = Bun.serve({
			port,
			fetch: async (request, server) => {
				const url = new URL(request.url);
				url.protocol = "ws:";
				url.host = request.headers.get("host") ?? "";
				url.port = port_string;
				if (url.pathname.startsWith(path)) {
					const { headers } = request;
					const ip = server.requestIP(request)?.address;
					if (!ip) throw new Error("IP is not defined.");
					try {
						const upgrade_response = await this.options?.onBeforeUpgrade?.({
							url,
							headers,
							ip: new IP(ip)
						});
						if (upgrade_response) return upgrade_response;
						server.upgrade(request, { data: {
							id: "",
							url,
							headers
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
	publish(channel, payload) {
		this.bun_server.publish(channel, payload);
	}
};

//#endregion
export { ExtWSBunServer };