import type { ClientOptions, ExtWSHealthcheckOptions } from '@extws/server';
import type { ExtWSOnBeforeUpgradeHandler } from '@extws/server/dev';
import type { ExtWSBunClient } from './client.js';

export type ServerOptions<ClientData> = {
	path?: string;
	port: number;
	healthcheck?: ExtWSHealthcheckOptions;
} & (undefined extends ClientData
	? { onBeforeUpgrade?: ExtWSOnBeforeUpgradeHandler<ClientData> }
	: { onBeforeUpgrade: ExtWSOnBeforeUpgradeHandler<ClientData> });

export type ServerData<ClientData> = {
	options: ClientOptions<ClientData>;
	client?: ExtWSBunClient<ClientData>;
};
