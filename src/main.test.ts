import { type ExtWSClient } from '@extws/server';
import {
	describe,
	test,
	expect,
	afterAll,
} from 'bun:test';
import {
	extwsServer,
	testBroadcast,
	testGroupJoin,
	testGroupLeave,
	testSendToGroup,
	testSendToSocket,
} from '../test/server.js';

const WEBSOCKET_URL = 'ws://localhost:8080/ws';
const ERROR_TIMEOUT = 'Timeout: No message received within the specified time';

// afterAll(async () => {
// 	await extwsServer.close();
// });

/**
 * Wait for a message from the target WebSocket with a timeout.
 * @param target - The target WebSocket.
 * @returns - A promise that resolves with the message or rejects on timeout.
 */
function waitMessage(target: WebSocket): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const timeout = setTimeout(
			() => {
				reject(new Error(ERROR_TIMEOUT));
			},
			100,
		);

		target.addEventListener(
			'message',
			(event) => {
				clearTimeout(timeout);
				resolve(event.data);
			},
			{ once: true },
		);
	});
}

/**
 * Create a WebSocket client and get the corresponding ExtWSClient.
 * @returns -
 */
async function createClient(): Promise<{
	websocket: WebSocket,
	extwsClient: ExtWSClient,
}> {
	const websocket = new WebSocket(WEBSOCKET_URL);

	await new Promise((resolve) => {
		websocket.addEventListener(
			'open',
			resolve,
			{
				once: true,
			},
		);
	});

	const init_message = await waitMessage(websocket);
	const client_id = JSON.parse(init_message.slice(1)).id;

	const extwsClient = extwsServer.clients.get(client_id)!;

	return {
		websocket,
		extwsClient,
	};
}

const client = await createClient();

describe('ExtWSBunServer', () => {
	test('ping', () => {
		const promise = waitMessage(client.websocket);

		client.websocket.send('2');

		expect(promise).resolves.toBe('3');
	});

	test('message', () => {
		const promise = waitMessage(client.websocket);

		client.websocket.send('4hello{"name":"world"}');

		expect(promise).resolves.toBe('4hello{"text":"Hello, world!"}');
	});
});

describe('broadcast', () => {
	test('broadcast', () => {
		const promise = waitMessage(client.websocket);

		testBroadcast();

		expect(promise).resolves.toBe('4{"foo":"bar"}');
	});
});

describe('groups', () => {
	test('before join any', () => {
		const promise = waitMessage(client.websocket);

		testSendToGroup('group');

		expect(promise).rejects.toThrowError(ERROR_TIMEOUT);
	});

	test('joined', () => {
		const promise = waitMessage(client.websocket);

		testGroupJoin(client.extwsClient, 'group');
		testSendToGroup('group');

		expect(promise).resolves.toBe('4{"foo":"bar"}');
	});

	test('joined to another group', () => {
		const promise = waitMessage(client.websocket);

		testGroupJoin(client.extwsClient, 'group');
		testSendToGroup('group_another');

		expect(promise).rejects.toThrowError(ERROR_TIMEOUT);
	});

	test('left', () => {
		const promise = waitMessage(client.websocket);

		testGroupLeave(client.extwsClient, 'group');
		testSendToGroup('group');

		expect(promise).rejects.toThrowError(ERROR_TIMEOUT);
	});
});

describe('send to socket', () => {
	test('to existing client', () => {
		const promise = waitMessage(client.websocket);

		testSendToSocket(client.extwsClient.id);

		expect(promise).resolves.toBe('4{"foo":"bar"}');
	});

	test('to non-existing client', () => {
		const promise = waitMessage(client.websocket);

		testSendToSocket('777');

		expect(promise).rejects.toThrowError(ERROR_TIMEOUT);
	});
});

describe('disconnect', () => {
	test('by server', () => {
		const promise = new Promise<boolean>((resolve) => {
			client.websocket.addEventListener(
				'close',
				(_) => {
					resolve(true);
				},
				{ once: true },
			);
		});

		client.extwsClient.disconnect();

		expect(promise).resolves.toBe(true);
	});

	test('by client', async () => {
		expect(extwsServer.clients.size).toBe(0);

		const client2 = await createClient();

		expect(extwsServer.clients.size).toBe(1);

		client2.websocket.close();

		await new Promise((resolve) => {
			setTimeout(
				resolve,
				100,
			);
		});

		expect(extwsServer.clients.size).toBe(0);
	});
});
