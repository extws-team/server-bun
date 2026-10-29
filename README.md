# @extws/server-bun

WebSocket server with [ExtWS message protocol](https://github.com/extws-team/server#protocol) for [Bun](https://bun.sh) runtime.

## Features

- 🚀 Custom message protocol that enables support for message types
- 👥 Group messaging system
- 🔄 Automatic connection management
- 🔐 Typed data attached to each client, such as a session
- 🔌 Automatic handling of broken or silently disconnected clients

## Installation

```bash
bun add @extws/server-bun
```

## Starting the server

To start the server, just create an instance of `ExtWSBunServer`.

```typescript
import { ExtWSBunServer } from '@extws/server-bun';

// Start the server.
const server = new ExtWSBunServer({
  port: 8080,
});
```

By default, the server listens for WebSocket connections for the `/ws` path. If you want to change the path, use `path` option.

```typescript
const server = new ExtWSBunServer({
  path: '/extws',
  port: 8080,
});
```

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `port` | `number` | | Port to listen on. |
| `path` | `string` | `'/ws'` | Path to accept WebSocket connections on. |
| `idleTimeout` | `number` | `60` | Seconds a client may stay silent before it is disconnected. |
| `pingTimeout` | `number` | `5` | Seconds a client has to answer a ping from the server. Must be less than `idleTimeout`. |
| `onBeforeUpgrade` | `function` | | Hook called before a WebSocket upgrade, see [Authorization and client data](#authorization-and-client-data). |
| `bun` | `object` | | Options of the underlying Bun server, see [Bun options](#bun-options). |

Once a client has been silent for `idleTimeout - pingTimeout` seconds, the server pings it, and disconnects the client if it does not answer within `pingTimeout` seconds. Clients also receive `idleTimeout` on connect, so [@extws/client](https://github.com/extws-team/client) can detect a server that went silent.

### Bun options

Options of the underlying [`Bun.serve()`](https://bun.com/docs/runtime/http/server) server and its [WebSocket handler](https://bun.com/docs/runtime/http/websockets) are passed in the `bun` option:

```typescript
const server = new ExtWSBunServer({
  port: 8080,
  bun: {
    reusePort: true,
    maxPayloadLength: 64 * 1024,
  },
});
```

Supported options are `reusePort`, `backpressureLimit`, `closeOnBackpressureLimit`, `maxPayloadLength` and `perMessageDeflate`, with Bun's defaults. Note that Bun accepts messages up to 16 MB by default.

### Authorization and client data

The `onBeforeUpgrade` hook is called before a connection is upgraded to WebSocket. It receives the request's `url`, `headers` and `ip`, and returns either a `Response` to reject the upgrade, or data to attach to the client as `client.data`:

```typescript
const server = new ExtWSBunServer({
  port: 8080,
  async onBeforeUpgrade({ headers }) {
    const session = await getSession(headers.get('cookie'));
    if (!session) {
      // any status and headers, such as `Set-Cookie`
      return new Response('Unauthorized', { status: 401 });
    }

    return { user_id: session.user_id };
  },
});

server.on('chat', (event) => {
  // typed as `{ user_id: number }`
  console.log(event.client.data.user_id);
});
```

The type of `client.data` is inferred from the hook. When the hook is missing or returns nothing, `client.data` is `undefined`. You can also declare the type explicitly, which makes the hook required:

```typescript
const server = new ExtWSBunServer<{ user_id: number }>({
  port: 8080,
  onBeforeUpgrade({ headers }) {
    // ...
  },
});
```

## Handling events

The key feature of ExtWS is its custom message protocol that allows efficient work with typed events. Instead of listening to all messages through a single WebSocket `message` event, ExtWS allows you to subscribe to specific event types.

### Event subscription

To listen for events sent by the client, use the `on` method:

```typescript
// Subscribe to all messages with type 'chat'
server.on('chat', (event) => {
  console.log('Chat message:', event.detail);
  console.log('From client:', event.client.id);
});
```

Event data is sent by the client, so `event.detail` is typed as `unknown`. Validate it before use with libraries like [valibot](https://github.com/valibot/valibot), [zod](https://github.com/colinhacks/zod) or similar:

```typescript
import * as v from 'valibot';

const ChatMessageSchema = v.object({
  message: v.string(),
  timestamp: v.number(),
});

server.on('chat', (event) => {
  const chat_message = v.parse(ChatMessageSchema, event.detail);

  console.log(chat_message.message);
  console.log(chat_message.timestamp);
});
```

To create one-time subscriptions, use `once` or `wait` methods:

```typescript
// Subscription will trigger only once
server.once('user:ready', (event) => {
  console.log(`User ${event.client.id} is ready`);
});

// wait() is essentially the same as once() but returns a Promise instead of using a callback
const event = await server.wait('user:ready');
console.log(`User ${event.client.id} is ready`);
```

### Built-in events

ExtWS has several built-in events that cannot be used for event types:

```typescript
// New client connected
server.on('connect', (event) => {
  console.log('New client connected:', event.client.id);
});

// Client disconnected
server.on('disconnect', (event) => {
  console.log('Client disconnected:', event.client.id);
});
```

### Unsubscribing from events

Methods `on` and `once` return a function that, when called, removes the event subscription:

```typescript
const off = server.on('message', (event) => {
  console.log(event.detail);
});

// Remove event subscription
off();
```

## Sending messages

ExtWS provides several ways to send messages: directly through the client or via the server.

#### To a specific client

If you have a client object, you can use the `send` method:

```typescript
client.send({ message: 'hello' }); // event of type 'message'
client.send('chat', { message: 'hello' }); // event of type 'chat'
client.send('typing'); // event of type 'typing' without data
client.send(); // event of type 'message' without data
```

If you have only the client ID, call the `sendToSocket` method on the server:

```typescript
const client_id = 'deadbeef';

server.sendToSocket(client_id, { message: 'hello' }); // event of type 'message'
server.sendToSocket(client_id, 'chat', { message: 'hello' }); // event of type 'chat'
server.sendToSocket(client_id, 'typing'); // event of type 'typing' without data
server.sendToSocket(client_id); // event of type 'message' without data
```

#### To a group of clients

To send a message to a group of clients, use the `sendToGroup` method on the server:

```typescript
server.sendToGroup('room1', { message: 'hello' }); // event of type 'message'
server.sendToGroup('room1', 'chat', { message: 'hello' }); // event of type 'chat'
server.sendToGroup('room1', 'typing'); // event of type 'typing' without data
server.sendToGroup('room1'); // event of type 'message' without data
```

#### To all clients of the server

To send a message to all clients, use the `broadcast` method on the server:

```typescript
server.broadcast({ message: 'hello' }); // event of type 'message'
server.broadcast('chat', { message: 'hello' }); // event of type 'chat'
server.broadcast('typing'); // event of type 'typing' without data
server.broadcast(); // event of type 'message' without data
```

## Groups

ExtWS has a built-in group system that allows organizing clients into logical groups for convenient message delivery to multiple clients simultaneously. Groups are identified by a string ID. Of course, client can be in multiple groups simultaneously.

```typescript
// Add client to group
client.join('room1');

// Send message to all clients in room1
server.sendToGroup('room1', 'chat', { message: 'Hello room!' });

// Remove client from group
client.leave('room1');
```

## Scaling

A single server only reaches its own clients. To run several servers and still reach every client from any of them, connect the servers with [@extws/adapter-redis](https://github.com/extws-team/adapter-redis).

## Stopping the server

To stop the server, call the `close` method:

```typescript
await server.close();
```
