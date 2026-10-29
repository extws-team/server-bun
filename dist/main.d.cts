import { ExtWS, ExtWSClient } from "@extws/server";
import { ExtWSOnBeforeUpgradeHandler } from "@extws/server/dev";
import { ServerWebSocket } from "bun";
type ServerData = {
  id: string;
  url: URL;
  headers: Headers;
};
declare class ExtWSBunClient extends ExtWSClient {
  private bun_client;
  constructor(server: ExtWSBunServer, bun_client: ServerWebSocket<ServerData>);
  override disconnect(): void;
}
export declare class ExtWSBunServer extends ExtWS {
  private bun_server;
  constructor({ path, port, ...options_rest }: {
    path?: string;
    port: number;
    onBeforeUpgrade?: ExtWSOnBeforeUpgradeHandler;
  });
  protected override publish(channel: string, payload: string): void;
}
export type { ExtWSBunClient };