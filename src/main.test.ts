// oxlint-disable max-lines-per-function
/* eslint-disable jsdoc/require-jsdoc */
// oxlint-disable max-nested-callbacks
// Wire assertions deliberately complete before sending the next frame.
// oxlint-disable no-await-in-loop

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
	type ClientData,
	createTestServer,
	ERROR_TIMEOUT,
	TestPeer,
	websocketURL,
	withTimeout,
} from '../test/server.js';

let server: ReturnType<typeof createTestServer>;
let peers: TestPeer<ClientData>[];

beforeEach(() => {
	server = createTestServer();
	peers = [];
});

afterEach(async () => {
	try {
		await server.close();
	} finally {
		await Promise.all(peers.map((peer) => peer.close()));
	}
});

function connect(postfix = '') {
	const peer = new TestPeer<ClientData>(websocketURL(server) + postfix);
	peers.push(peer);
	return peer.connect(server);
}

async function expectQuiet(...targets: TestPeer<ClientData>[]) {
	await Promise.all(
		targets.map(async (peer) => {
			await expect(peer.next(80)).rejects.toThrow(ERROR_TIMEOUT);
		}),
	);
}

describe('ExtWSBunServer real transport', () => {
	test('async upgrade rejection leaves no registered client', async () => {
		const response = await fetch(
			`${websocketURL(server).replace('ws:', 'http:')}?drop=1`,
			{
				headers: {
					Connection: 'Upgrade',
					Upgrade: 'websocket',
					'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
					'Sec-WebSocket-Version': '13',
				},
			},
		);
		expect(response.status).toBe(400);
		expect(response.headers.get('x-test')).toBe('test');
		expect(await response.text()).toBe('drop');
		expect(server.clients.size).toBe(0);
	});

	test('exactly one INIT and server connect, with persistent mutable data', async () => {
		const connected: ClientData[] = [];
		const disconnected: ClientData[] = [];
		server.on('connect', (event) => {
			connected.push(event.client.data);
		});
		server.on('disconnect', (event) => {
			disconnected.push(event.client.data);
		});
		const peer = await connect('?user_id=alice');
		expect(peer.init).toEqual({ id: peer.client.id, idle_timeout: 60 });
		expect(peer.client.id).toMatch(/^[A-Za-z0-9]{16}$/u);
		expect(connected).toEqual([{ user_id: 'alice', mutable: true }]);
		peer.client.data = { user_id: 'updated', mutable: false };
		server.on('inspect', (event) => {
			expect(event.client.data).toBe(peer.client.data);
			event.client.send({ ...event.client.data });
		});
		peer.websocket.send('4inspect');
		await expect(peer.next()).resolves.toBe(
			'4{"user_id":"updated","mutable":false}',
		);
		await expectQuiet(peer);
		expect(
			peer.messages.filter((message) => message.startsWith('1')),
		).toHaveLength(1);
		const removed = new Promise<void>((resolve) => {
			server.once('disconnect', () => resolve());
		});
		await peer.close();
		await withTimeout(removed);
		expect(server.clients.size).toBe(0);
		expect(disconnected).toEqual([peer.client.data]);
		expect(peer.client.data).toEqual({ user_id: 'updated', mutable: false });
	});

	test.each(['text', 'binary'])(
		'%s ExtWS message and application ping/pong',
		async (format) => {
			const peer = await connect();
			function send(payload: string) {
				peer.websocket.send(
					format === 'binary' ? Buffer.from(payload) : payload,
				);
			}

			send('2');
			await expect(peer.next()).resolves.toBe('3');
			send('4hello{"name":"world"}');
			await expect(peer.next()).resolves.toBe('4hello{"text":"Hello, world!"}');
		},
	);

	test.each(['{"foo":  "bar"}', '[1, {"two":2}]'])(
		'raw JSON is preserved across all send APIs: %s',
		async (raw) => {
			const a = await connect();
			const b = await connect();
			const outsider = await connect();
			a.client.join('group');
			a.client.join('group');
			b.client.join('group');
			for (const named of [false, true]) {
				const wire = `4${named ? 'news' : ''}${raw}`;
				if (named) {
					a.client.send('news', raw);
				} else {
					a.client.send(raw);
				}

				await expect(a.next()).resolves.toBe(wire);
				if (named) {
					server.sendToSocket(b.client.id, 'news', raw);
				} else {
					server.sendToSocket(b.client.id, raw);
				}

				await expect(b.next()).resolves.toBe(wire);
				if (named) {
					server.sendToGroup('group', 'news', raw);
				} else {
					server.sendToGroup('group', raw);
				}

				await expect(a.next()).resolves.toBe(wire);
				await expect(b.next()).resolves.toBe(wire);
				await expectQuiet(a, b, outsider);
				if (named) {
					server.broadcast('news', raw);
				} else {
					server.broadcast(raw);
				}

				for (const peer of [a, b, outsider]) {
					await expect(peer.next()).resolves.toBe(wire);
				}

				await expectQuiet(a, b, outsider);
			}

			b.client.leave('group');
			server.sendToGroup('group', { foo: 'bar' });
			await expect(a.next()).resolves.toBe('4{"foo":"bar"}');
			server.sendToSocket('missing', raw);
			await expectQuiet(a, b, outsider);
		},
	);

	test('reserved events cannot spoof lifecycle or adapter events', async () => {
		const peer = await connect();
		const observed: string[] = [];
		for (const type of ['connect', 'disconnect', 'p.socket', 'p.channel']) {
			server.on(type, () => {
				observed.push(`server:${type}`);
			});
			peer.client.on(type, () => {
				observed.push(`client:${type}`);
			});
			peer.websocket.send(`4${type}{"spoof":true}`);
		}

		// A valid message is a barrier: all preceding frames have been processed.
		peer.websocket.send('4hello{"name":"barrier"}');
		await expect(peer.next()).resolves.toBe('4hello{"text":"Hello, barrier!"}');
		expect(observed).toEqual([]);
		expect(server.clients.get(peer.client.id)).toBe(peer.client);
	});

	test('local/reentrant disconnect is single-shot and post-close operations are inert', async () => {
		const peer = await connect();
		let clientDisconnects = 0;
		let serverDisconnects = 0;
		peer.client.on('disconnect', () => {
			clientDisconnects++;
			peer.client.disconnect();
			peer.client.send({ late: true });
			peer.client.ping();
			peer.client.join('late');
			peer.client.leave('late');
		});
		server.on('disconnect', () => serverDisconnects++);
		peer.client.disconnect();
		peer.client.disconnect();
		await withTimeout(peer.closed);
		expect(clientDisconnects).toBe(1);
		expect(serverDisconnects).toBe(1);
		expect(server.clients.size).toBe(0);
		expect(peer.messages).toHaveLength(1);
	});

	test('parallel, reentrant and repeated shutdown share one Promise and close the listener', async () => {
		const a = await connect();
		const b = await connect();
		const url = websocketURL(server).replace('ws:', 'http:');
		const reentrant: Promise<void>[] = [];
		server.on('disconnect', () => {
			reentrant.push(server.close());
		});
		a.client.on('disconnect', () => {
			reentrant.push(server.close());
		});
		b.client.on('disconnect', () => {
			reentrant.push(server.close());
		});
		const first = server.close();
		expect(server.close()).toBe(first);
		await withTimeout(first);
		expect(reentrant).toHaveLength(4);
		for (const promise of reentrant) {
			expect(promise).toBe(first);
		}

		await Promise.all([withTimeout(a.closed), withTimeout(b.closed)]);
		expect(server.clients.size).toBe(0);
		await expect(server.close()).resolves.toBeUndefined();
		await expect(fetch(url)).rejects.toThrow();
	});
});
