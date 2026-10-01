import { ExtWS, ExtWSClient } from "@extws/server";
import { ExtWSOnBeforeUpgradeHandler } from "@extws/server/dev";
//#region src/types.d.ts
type ServerData<ClientData = undefined> = {
  id: string;
  url: URL;
  headers: Headers;
} & ([ClientData] extends [undefined] ? {
  data?: undefined;
} : {
  data: ClientData;
});
//#endregion
//#region src/client.d.ts
declare class ExtWSBunClient<ClientData = undefined> extends ExtWSClient<ClientData> {
  private bun_client;
  constructor(server: ExtWSBunServer<ClientData>, bun_client: Bun.ServerWebSocket<ServerData<ClientData>>);
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
export declare class ExtWSBunServer<ClientData = undefined> extends ExtWS<ClientData> {
  private bun_server;
  constructor({ path, port, idle_timeout, ...options_rest }: {
    path?: string;
    port: number;
    idle_timeout?: number;
  } & ([ClientData] extends [undefined] ? {
    onBeforeUpgrade?: ExtWSOnBeforeUpgradeHandler<ClientData>;
  } : {
    onBeforeUpgrade: ExtWSOnBeforeUpgradeHandler<ClientData>;
  }));
  override publish(channel: string, payload: string): void;
  override close(): Promise<void>;
}
//#endregion
export type { ExtWSBunClient };