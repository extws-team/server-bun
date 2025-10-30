//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
let __extws_server = require("@extws/server");
__extws_server = __toESM(__extws_server);
let __kirick_ip = require("@kirick/ip");
__kirick_ip = __toESM(__kirick_ip);

//#region src/client.ts
var ExtWSBunClient = class extends __extws_server.ExtWSClient {
	bun_client;
	constructor(server, bun_client) {
		super(server, {
			url: bun_client.data.url,
			headers: bun_client.data.headers,
			ip: new __kirick_ip.IP(bun_client.remoteAddress)
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
var ExtWSBunServer = class extends __extws_server.ExtWS {
	bun_server;
	constructor({ path = "/ws", port,...options_rest }) {
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
						const upgrade_response = await options_rest.onBeforeUpgrade?.({
							url,
							headers,
							ip: new __kirick_ip.IP(ip)
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
exports.ExtWSBunServer = ExtWSBunServer;