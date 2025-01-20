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
  addToGroup(group_id) {
    try {
      this.bun_client.subscribe(group_id);
    } catch (error) {
      console.error(error);
      this.disconnect();
    }
  }
  removeFromGroup(group_id) {
    try {
      this.bun_client.unsubscribe(group_id);
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
class ExtWSBunServer extends import_server2.ExtWS {
  bun_server;
  constructor({
    path = "/ws",
    port
  }) {
    super();
    const port_string = String(port);
    this.bun_server = Bun.serve({
      port,
      fetch(request, server) {
        const url = new URL(request.url);
        url.protocol = "ws:";
        url.host = request.headers.get("host") ?? "";
        url.port = port_string;
        if (url.pathname.startsWith(path)) {
          server.upgrade(request, {
            data: {
              url,
              headers: request.headers
            }
          });
          return;
        }
        return new Response("Upgrade failed", { status: 500 });
      },
      websocket: {
        open: (bun_client) => {
          const client = new ExtWSBunClient(this, bun_client);
          bun_client.data.extws_client_id = client.id;
          this.onConnect(client);
        },
        message: (bun_client, payload) => {
          const client = this.clients.get(bun_client.data.extws_client_id);
          if (client) {
            this.onMessage(client, payload);
          }
        },
        close: (bun_client) => {
          const client = this.clients.get(bun_client.data.extws_client_id);
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
