
import ExtWSClient from '@extws/server/client'; // eslint-disable-line import/no-unresolved, import/extensions

export default class ExtWSBunClient extends ExtWSClient {
    #bun_client;

    constructor (
        bun_client,
        ...args
    ) {
        super(...args);

        this.#bun_client = bun_client;
    }

    addToGroup (group_id) {
        try {
            this.#bun_client.subscribe(group_id);
        }
        catch (error) {
			console.error(error);
			this.disconnect();
		}
    }

    removeFromGroup (group_id) {
        try {
            this.#bun_client.unsubscribe(group_id);
        }
        catch (error) {
			console.error(error);
			this.disconnect();
		}
    }

    sendPayload(payload) {
		try {
			this.#bun_client.send(payload);
		}
		catch (error) {
			console.error(error);
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