var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// src/main.ts
var exports_main = {};
__export(exports_main, {
  ExtWSBunServer: () => ExtWSBunServer
});
module.exports = __toCommonJS(exports_main);
var import_server2 = require("@extws/server");
var import_ip2 = require("@kirick/ip");

// src/client.ts
var import_server = require("@extws/server");
var import_ip = require("@kirick/ip");

class ExtWSBunClient extends import_server.ExtWSClient {
  bun_client;
  constructor(server, bun_client) {
    super(server, {
      url: bun_client.data.url,
      headers: bun_client.data.headers,
      ip: new import_ip.IP(bun_client.remoteAddress)
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
    } catch {
    }
    super.disconnect();
  }
}

// src/main.ts
function headersToMap(headers) {
  return new Map(Object.entries(headers.toJSON()));
}

class ExtWSBunServer extends import_server2.ExtWS {
  bun_server;
  constructor({
    path = "/ws",
    port,
    ...options_rest
  }) {
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
          const headers = headersToMap(request.headers);
          const ip = server.requestIP(request)?.address;
          if (!ip) {
            throw new Error("IP is not defined.");
          }
          try {
            const upgrade_response = await this.options?.onBeforeUpgrade?.({
              url,
              headers,
              ip: new import_ip2.IP(ip)
            });
            if (upgrade_response) {
              const response_headers = new Headers;
              if (upgrade_response.headers) {
                for (const [key, value] of Object.entries(upgrade_response.headers)) {
                  if (value !== undefined) {
                    response_headers.set(key, value);
                  }
                }
              }
              return new Response(upgrade_response.body ?? "", {
                status: upgrade_response.status,
                headers: response_headers
              });
            }
            server.upgrade(request, {
              data: {
                id: "",
                url,
                headers
              }
            });
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
          if (client) {
            this.onMessage(client, payload);
          }
        },
        close: (bun_client) => {
          const client = this.clients.get(bun_client.data.id);
          if (client) {
            client.disconnect();
          }
        }
      }
    });
  }
  publish(channel, payload) {
    this.bun_server.publish(channel, payload);
  }
}
