import { ExtWS, ExtWSClient } from "@extws/server";
import { ExtWSOnBeforeUpgradeHandler } from "@extws/server/dev";
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
  constructor(server: ExtWSBunServer, bun_client: Bun.ServerWebSocket<ServerData>);
  /** @internal */
  override _addToChannel(channel_id: string): void;
  /** @internal */
  override _removeFromChannel(channel_id: string): void;
  /** @internal */
  override _sendPayload(payload: string): void;
  override disconnect(): void;
}
//#endregion
//#region src/main.d.ts
export declare class ExtWSBunServer extends ExtWS {
  private bun_server;
  constructor({ path, port, ...options_rest }: {
    path?: string;
    port: number;
    onBeforeUpgrade?: ExtWSOnBeforeUpgradeHandler;
  });
  override publish(channel: string, payload: string): void;
}
//#endregion
export type { ExtWSBunClient };