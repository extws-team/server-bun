/* eslint-disable jsdoc/require-jsdoc */

import type { ExtWSClient, ExtWSEvent } from '@extws/server';
import { ExtWSBunServer } from '../src/main.js';

export const extwsServer: ExtWSBunServer = new ExtWSBunServer({
	port: 8080,
	async onBeforeUpgrade({ url }) {
		await new Promise((resolve) => {
			setTimeout(resolve, 1);
		});

		if (url.searchParams.has('drop')) {
			return new Response('drop', {
				status: 400,
				headers: {
					'x-test': 'test',
				},
			});
		}
	},
});

extwsServer.on('hello', (event) => {
	event.client.send('hello', {
		text: `Hello, ${(event as ExtWSEvent<{ name: string }>).detail.name}!`,
	});
});

export function testBroadcast(): void {
	extwsServer.broadcast({ foo: 'bar' });
}

export function testGroupJoin(extwsClient: ExtWSClient, name: string): void {
	extwsClient.join(name);
}

export function testGroupLeave(extwsClient: ExtWSClient, name: string): void {
	extwsClient.leave(name);
}

export function testSendToGroup(group_name: string): void {
	extwsServer.sendToGroup(group_name, {
		foo: 'bar',
	});
}

export function testSendToSocket(client_id: string): void {
	extwsServer.sendToSocket(client_id, {
		foo: 'bar',
	});
}
