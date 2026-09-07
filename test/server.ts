/* eslint-disable jsdoc/require-jsdoc */

import type { ExtWSClient, ExtWSEvent } from '@extws/server';
import type { Server } from 'bun';
import { type ExtWSBunClient, ExtWSBunServer } from '../src/main.js';
import type { ServerData } from '../src/types.js';

export interface ClientData {
	user_id: string;
	mutable: boolean;
}

export const ERROR_TIMEOUT =
	'Timeout: No message received within the specified time';

export function deferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T | PromiseLike<T>) => void;
	reject: (reason?: unknown) => void;
} {
	let resolveDeferred!: (value: T | PromiseLike<T>) => void;
	let rejectDeferred!: (reason?: unknown) => void;
	// eslint-disable-next-line unicorn/prefer-promise-with-resolvers -- Node compatibility rule forbids Promise.withResolvers.
	const promise = new Promise<T>((resolve, reject) => {
		resolveDeferred = resolve;
		rejectDeferred = reject;
	});
	return { promise, resolve: resolveDeferred, reject: rejectDeferred };
}

export function withTimeout<T>(
	promise: Promise<T>,
	milliseconds = 2000,
): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(ERROR_TIMEOUT)),
			milliseconds,
		);
		(async () => {
			try {
				const value = await promise;
				clearTimeout(timer);
				resolve(value);
			} catch (error: unknown) {
				clearTimeout(timer);
				reject(error);
			}
		})();
	});
}

// The adapter owns its listener but does not expose the assigned ephemeral port.
export function transportOf<T>(
	server: ExtWSBunServer<T>,
): Server<ServerData<T>> {
	return (server as unknown as { bun_server: Server<ServerData<T>> })
		.bun_server;
}

export function websocketURL<T>(server: ExtWSBunServer<T>): string {
	return `ws://127.0.0.1:${transportOf(server).port}/ws`;
}

export function createTestServer(): ExtWSBunServer<ClientData> {
	const server = new ExtWSBunServer<ClientData>({
		port: 0,
		async onBeforeUpgrade({ url }) {
			await Bun.sleep(1);
			if (url.searchParams.has('drop')) {
				return new Response('drop', {
					status: 400,
					headers: { 'x-test': 'test' },
				});
			}

			return {
				user_id: url.searchParams.get('user_id') ?? 'test',
				mutable: true,
			};
		},
	});
	server.on('hello', (event) => {
		event.client.send('hello', {
			text: `Hello, ${(event as ExtWSEvent<{ name: string }, ClientData>).detail.name}!`,
		});
	});
	return server;
}

export class TestPeer<T> {
	readonly websocket: WebSocket;
	readonly opened: Promise<void>;
	readonly closed: Promise<CloseEvent>;
	readonly messages: string[] = [];
	client!: ExtWSBunClient<T>;
	init!: { id: string; idle_timeout: number };
	private queue: string[] = [];
	private pending?: ReturnType<typeof deferred<string>>;

	constructor(url: string) {
		this.websocket = new WebSocket(url);
		this.opened = new Promise((resolve, reject) => {
			this.websocket.addEventListener('open', () => resolve(), { once: true });
			this.websocket.addEventListener('error', reject, { once: true });
		});
		this.closed = new Promise((resolve) => {
			this.websocket.addEventListener('close', resolve, { once: true });
		});
		this.websocket.addEventListener('message', (event) => {
			const message = String(event.data);
			this.messages.push(message);
			if (this.pending) {
				const { pending } = this;
				this.pending = undefined;
				pending.resolve(message);
			} else {
				this.queue.push(message);
			}
		});
	}

	async next(milliseconds = 2000): Promise<string> {
		if (this.queue.length > 0) {
			return this.queue.shift()!;
		}

		if (this.pending) {
			throw new Error('Only one pending read per peer is supported');
		}

		const pending = deferred<string>();
		this.pending = pending;
		try {
			return await withTimeout(pending.promise, milliseconds);
		} finally {
			if (this.pending === pending) {
				this.pending = undefined;
			}
		}
	}

	async connect(server: ExtWSBunServer<T>): Promise<this> {
		await withTimeout(this.opened);
		const message = await this.next();
		if (!message.startsWith('1{')) {
			throw new Error(`Expected INIT, received ${message}`);
		}

		this.init = JSON.parse(message.slice(1));
		const client = server.clients.get(this.init.id);
		if (!client) {
			throw new Error('INIT client is not registered');
		}

		this.client = client;
		return this;
	}

	async close(): Promise<void> {
		if (this.websocket.readyState !== WebSocket.CLOSED) {
			this.websocket.close();
		}

		await withTimeout(this.closed);
	}
}

export function testBroadcast(server: ExtWSBunServer<ClientData>): void {
	server.broadcast({ foo: 'bar' });
}

export function testGroupJoin<T>(client: ExtWSClient<T>, name: string): void {
	client.join(name);
}

export function testGroupLeave<T>(client: ExtWSClient<T>, name: string): void {
	client.leave(name);
}

export function testSendToGroup(
	server: ExtWSBunServer<ClientData>,
	name: string,
): void {
	server.sendToGroup(name, { foo: 'bar' });
}

export function testSendToSocket(
	server: ExtWSBunServer<ClientData>,
	id: string,
): void {
	server.sendToSocket(id, { foo: 'bar' });
}
