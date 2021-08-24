import { EventEmitter } from '@baileyherbert/common';
import { WebClient } from './WebClient';
import { WebSubscriptionManager } from './WebSubscriptionManager';

/**
 * This class is a child subscription manager which manages specific features within a top level subscription.
 * Yawn... mucho tiredo.
 */
export class WebSubscriptionFeature extends EventEmitter<Events> {

	private _clients = new Set<WebClient>();

	public constructor(public manager: WebSubscriptionManager) {
		super();
	}

	/**
	 * The number of clients listening to this subscription.
	 */
	public get length() {
		return this._clients.size;
	}

	/**
	 * Emits an event to all clients on this subscription.
	 *
	 * @param name
	 * @param args
	 */
	public emit(name: string, ...args: any[]) {
		for (const client of this._clients) {
			client.emit(name, ...args);
		}
	}

	/**
	 * Adds the given client to this manager.
	 *
	 * @param client
	 */
	public addClient(client: WebClient) {
		client.features.add(this);
		this._clients.add(client);
		this._emit('subscribed', client);
	}

	/**
	 * Removes the given client from this manager.
	 *
	 * @param client
	 */
	public removeClient(client: WebClient) {
		client.features.delete(this);
		this._clients.delete(client);
		this._emit('unsubscribed', client);
	}

}

type Events = {
	subscribed: [client: WebClient];
	unsubscribed: [client: WebClient];
}
