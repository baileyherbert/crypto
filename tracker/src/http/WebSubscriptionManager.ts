import { Account } from '../core/Account';
import { WebClient } from './WebClient';
import { WebManager } from './WebManager';
import { WebSubscriptionFeature } from './WebSubscriptionFeature';

/**
 * This class makes it easy for the backend to send events to all clients who are subscribed to a certain account.
 */
export class WebSubscriptionManager {

	private _clients = new Set<WebClient>();
	private _features = new Map<string, WebSubscriptionFeature>();

	public constructor(public manager: WebManager, public account: Account) {

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
		this._clients.add(client);
	}

	/**
	 * Removes the given client from this manager.
	 *
	 * @param client
	 */
	public removeClient(client: WebClient) {
		this._clients.delete(client);
	}

	/**
	 * Returns a child subscription manager for the specified feature.
	 *
	 * **Memory leak warning:** Each distinct name provided will create a new manager!
	 *
	 * @param name
	 * @returns
	 */
	public getFeature(name: string): WebSubscriptionFeature {
		if (!this._features.has(name)) {
			this._features.set(name, new WebSubscriptionFeature(this));
		}

		return this._features.get(name)!;
	}

}
