import { ExtWS, ExtWSClient } from "@extws/server";
import { ExtWSOnBeforeUpgradeOptions, ExtWSOptions } from "@extws/server/dev";
import { Serve, ServerWebSocket, WebSocketHandler } from "bun";
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
  constructor({ path, port, bun, idleTimeout, pingTimeout, ...options_rest }: {
    path?: string;
    port: number;
    /**
     * Options of the underlying `Bun.serve()` server and its WebSocket handler.
     * @see https://bun.com/docs/runtime/http/websockets
     */
    bun?: Pick<Serve.HostnamePortServeOptions<unknown>, "reusePort"> & Pick<WebSocketHandler<unknown>, "backpressureLimit" | "closeOnBackpressureLimit" | "maxPayloadLength" | "perMessageDeflate">;
  } & ExtWSOptions & ExtWSOnBeforeUpgradeOptions<TData>);
  override close(): Promise<void>;
}
export type { ExtWSBunClient };