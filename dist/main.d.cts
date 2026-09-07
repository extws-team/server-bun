import { ClientOptions, ExtWS, ExtWSClient, ExtWSHealthcheckOptions } from "@extws/server";
import { ServerWebSocket } from "bun";
import { ExtWSOnBeforeUpgradeHandler } from "@extws/server/dev";

//#region src/types.d.ts
type ServerOptions<ClientData> = {
  path?: string;
  port: number;
  healthcheck?: ExtWSHealthcheckOptions;
} & (undefined extends ClientData ? {
  onBeforeUpgrade?: ExtWSOnBeforeUpgradeHandler<ClientData>;
} : {
  onBeforeUpgrade: ExtWSOnBeforeUpgradeHandler<ClientData>;
});
type ServerData<ClientData> = {
  options: ClientOptions<ClientData>;
  client?: ExtWSBunClient<ClientData>;
};
//#endregion
//#region src/client.d.ts
declare class ExtWSBunClient<ClientData = undefined> extends ExtWSClient<ClientData> {
  private bun_client;
  constructor(server: ExtWSBunServer<ClientData>, bun_client: ServerWebSocket<ServerData<ClientData>>);
  ownsTransport(bun_client: ServerWebSocket<ServerData<ClientData>>): boolean;
  protected addToChannel(channel_id: string): void;
  protected removeFromChannel(channel_id: string): void;
  protected sendPayload(payload: string): void;
  protected closeTransport(): void;
}
//#endregion
//#region src/main.d.ts
declare class ExtWSBunServer<ClientData = undefined> extends ExtWS<ClientData> {
  clients: Map<string, ExtWSBunClient<ClientData>>;
  private bun_server;
  private close_promise?;
  constructor(options: ServerOptions<ClientData>);
  publish(channel: string, payload: string): void;
  close(): Promise<void>;
  private closeServer;
}
//#endregion
export { type ExtWSBunClient, ExtWSBunServer };