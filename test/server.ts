/* eslint-disable jsdoc/require-jsdoc */

import type { ExtWSClient, ExtWSEvent } from '@extws/server';
import { ExtWSBunServer } from '../src/main.js';

export type TestData = { name: string } | undefined;

export const extwsServer = new ExtWSBunServer<TestData>({
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

		const name = url.searchParams.get('name');
		if (name) {
			return { name };
		}
	},
});

extwsServer.on('hello', (event) => {
	event.client.send('hello', {
		text: `Hello, ${(event as ExtWSEvent<{ name: string }>).detail.name}!`,
	});
});

export function testBroadcast() {
	extwsServer.broadcast({ foo: 'bar' });
}

export function testGroupJoin(
	extwsClient: ExtWSClient<TestData>,
	name: string,
) {
	extwsClient.join(name);
}

export function testGroupLeave(
	extwsClient: ExtWSClient<TestData>,
	name: string,
) {
	extwsClient.leave(name);
}

export function testSendToGroup(group_name: string) {
	extwsServer.sendToGroup(group_name, {
		foo: 'bar',
	});
}

export function testSendToSocket(client_id: string) {
	extwsServer.sendToSocket(client_id, {
		foo: 'bar',
	});
}
