
const { IDLE_TIMEOUT,
        GROUP_BROADCAST,
        GROUP_PREFIX   } = require('extws-server/src/data');
const ExtWSDriver        = require('extws-server/src/driver');
const ExtWSClient        = require('extws-server/src/client');
const { Address6 }       = require('ip-address');

const subnet4in6 = new Address6('::ffff:0:0/96');
const path_regexp = new RegExp(/^\/ws(\/|$)/);

class ExtWSOnBunDriver extends ExtWSDriver {
    constructor ({
        port,
        path,
        // payload_max_length,
    }) {
        super();

        this._bun_server = Bun.serve({
            development: true,
            port,
            fetch(request, server) {
                const url = new URL(request.url);
                if (true === path_regexp.test(url.pathname)) {
                    server.upgrade(request, {
                        data: {
                            headers: request.headers,
                            url,
                        },
                    }); 		
                }
            },
            websocket: {
                open: (bun_client) => {
                    bun_client.subscribe(GROUP_BROADCAST);

                    const client = new ExtWSOnBunClient(
                        this,
                        bun_client,
                    );

                    bun_client._extws = {
                        id: client.id,
                    };

                    {
                        const ip_address = Address6.fromUnsignedByteArray(
                            Buffer.from(
                                bun_client.remoteAddress,
                            ),
                        );
                        // console.log('IP', Buffer.from(uws_client.getRemoteAddress()));
                        // console.log('IP', ip_address);

                        const is_v4 = ip_address.isInSubnet(subnet4in6);
                        // console.log('IP is_v4', is_v4);
                        client.remoteAddress = (is_v4 ? ip_address.to4() : ip_address).address;
                        // console.log('IP remoteAddress', client.remoteAddress);
                        client.remoteAddress6 = is_v4 ? Address6.fromAddress4(client.remoteAddress) : ip_address;
                        // console.log('IP remoteAddress6', client.remoteAddress6);
                    }

                    client.headers = {};
                    for (const [ key, value ] of Object.entries(bun_client.data.headers)) {
                        client.headers[key] = value;
                    }

                    client.url = bun_client.data.url;

                    this._onConnect(client);
                },
                message: (bun_client, payload) => {
                    const client = this.clients.get(bun_client._extws.id);
                    if (client instanceof ExtWSClient) {
                        this._onMessage(
                            client,
                            Buffer.from(payload).toString(),
                        );
                    }
                },
                close: (bun_client) => {
                    const client = this.clients.get(bun_client._extws.id);
                    if (client instanceof ExtWSClient) {
                        client.disconnect(
                            true, // is_already_disconnected
                        );
                    }
                }, 
            },
        });

        // this._uws_server.ws(
        //     path,
        //     {
        //         compression: 1, // perMessageDeflate: true
        //         maxPayloadLength: payload_max_length, // ne budet
        //         idleTimeout: IDLE_TIMEOUT, // seconds (netu v bun)

        //         upgrade: (response, request, context) => {
        //             const headers = {};
        //             request.forEach((key, value) => {
        //                 headers[key] = value;
        //             });

        //             response.upgrade(
        //                 {
        //                     url: new URL(
        //                         request.getUrl() + '?' + request.getQuery(),
        //                         'ws://' + headers.host,
        //                     ),
        //                     headers,
        //                 },
        //                 request.getHeader('sec-websocket-key'),
        //                 request.getHeader('sec-websocket-protocol'),
        //                 request.getHeader('sec-websocket-extensions'),
        //                 context,
        //             );
        //         },
        //         open: (bun_client) => {
        //             bun_client.subscribe(GROUP_BROADCAST);

        //             const client = new ExtWSOnBunClient(
        //                 this,
        //                 bun_client,
        //             );

        //             bun_client._extws = {
        //                 id: client.id,
        //             };

        //             {
        //                 const ip_address = Address6.fromUnsignedByteArray(
        //                     Buffer.from(
        //                         bun_client.remoteAddress,
        //                     ),
        //                 );
        //                 // console.log('IP', Buffer.from(uws_client.getRemoteAddress()));
        //                 // console.log('IP', ip_address);

        //                 const is_v4 = ip_address.isInSubnet(subnet4in6);
        //                 // console.log('IP is_v4', is_v4);
        //                 client.remoteAddress = (is_v4 ? ip_address.to4() : ip_address).address;
        //                 // console.log('IP remoteAddress', client.remoteAddress);
        //                 client.remoteAddress6 = is_v4 ? Address6.fromAddress4(client.remoteAddress) : ip_address;
        //                 // console.log('IP remoteAddress6', client.remoteAddress6);
        //             }

        //             client.headers = {};
        //             for (const [ key, value ] of Object.entries(bun_client.data.headers)) {
        //                 client.headers[key] = value;
        //             }

        //             client.url = bun_client.url;

        //             this._onConnect(client);
        //         },
        //         message: (bun_client, payload, is_binary) => {
        //             const client = this.clients.get(bun_client._extws.id);

        //             if (client instanceof ExtWSClient) {
        //                 if (!is_binary) {
        //                     this._onMessage(
        //                         client,
        //                         Buffer.from(payload).toString(),
        //                     );
        //                 }
        //             }
        //         },
        //         close: (bun_client) => {
        //             const client = this.clients.get(bun_client._extws.id);
        //             if (client instanceof ExtWSClient) {
        //                 client.disconnect(
        //                     true, // is_already_disconnected
        //                 );
        //             }
        //         },
        //     },
        // );

        // this._uws_server.listen(
        //     port,
        //     () => {},
        // );
    }

    publish (channel, payload) {
        this._bun_server.publish(
            channel,
            payload,
        );
    }
}

module.exports = ExtWSOnBunDriver;

class ExtWSOnBunClient extends ExtWSClient {
    constructor (driver, bun_client) {
        super();

        this._driver = driver;
        this._bun_client = bun_client;
    }

    emit (payload) {
        try {
            this._bun_client.send(payload);
        }
        catch {
            this.disconnect();
        }
    }

    join (group_id) {
        try {
            this._bun_client.subscribe(
                GROUP_PREFIX + group_id,
            );
        }
        catch {
            // console.log('error happened @ join');
            this.disconnect();
        }
    }

    leave (group_id) {
        try {
            this._bun_client.unsubscribe(
                GROUP_PREFIX + group_id,
            );
        }
        catch {
            // console.log('error happened @ leave');
            this.disconnect();
        }
    }

    disconnect (
        is_already_disconnected = false,
        hard = false,
    ) {
        if (true === hard || true !== is_already_disconnected) {
            try {
                this._bun_client.close();
            }
            catch {}
        }

        super.disconnect();
    }
}