import { ExtWS, ExtWSClient } from "@extws/server";
import { ExtWSOnBeforeUpgradeOptions } from "@extws/server/dev";
import { ServerWebSocket } from "bun";
type ServerData<TData extends Record<string, unknown> | undefined> = {
  id: string;
  url: URL;
  headers: Headers;
  data: TData;
};
declare class ExtWSBunClient<TData extends Record<string, unknown> | undefined = undefined> extends ExtWSClient<TData> {
  private bun_client;
  constructor(server: ExtWSBunServer<TData>, bun_client: ServerWebSocket<ServerData<TData>>);
  override disconnect(): void;
}
export declare class ExtWSBunServer<TData extends Record<string, unknown> | undefined = undefined> extends ExtWS<TData> {
  private bun_server;
  constructor({ path, port, ...options_rest }: {
    path?: string;
    port: number;
  } & ExtWSOnBeforeUpgradeOptions<TData>);
}
export type { ExtWSBunClient };