import { ExtWS, ExtWSClient } from "@extws/server";
import { ExtWSOnBeforeUpgradeHandler } from "@extws/server/dev";
import { ServerWebSocket } from "bun";

//#region src/types.d.ts
type ServerData = {
  id: string;
  url: URL;
  headers: Headers;
};
//#endregion
//#region src/client.d.ts
declare class ExtWSBunClient extends ExtWSClient {
  private bun_client;
  constructor(server: ExtWSBunServer, bun_client: ServerWebSocket<ServerData>);
  protected addToChannel(channel_id: string): void;
  protected removeFromChannel(channel_id: string): void;
  protected sendPayload(payload: string): void;
  disconnect(): void;
}
//#endregion
//#region src/main.d.ts
declare class ExtWSBunServer extends ExtWS {
  private bun_server;
  constructor({
    path,
    port,
    ...options_rest
  }: {
    path?: string;
    port: number;
    onBeforeUpgrade?: ExtWSOnBeforeUpgradeHandler;
  });
  publish(channel: string, payload: string): void;
}
//#endregion
export { type ExtWSBunClient, ExtWSBunServer };