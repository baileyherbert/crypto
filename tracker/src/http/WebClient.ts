import { Socket } from 'socket.io';
import { Account } from '../core/Account';
import { WebSubscriptionFeature } from './WebSubscriptionFeature';

export class WebClient {

	public features = new Set<WebSubscriptionFeature>();

	public constructor(public socket: Socket, public account: Account) {

	}

	/**
	 * Emits an event to the client.
	 *
	 * @param name
	 * @param args
	 */
	 public emit(name: string, ...args: any[]) {
		this.socket.emit(name, ...args);
	}

}
