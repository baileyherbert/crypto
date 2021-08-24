import { Logger } from '@baileyherbert/common';
import { Server, Socket } from 'socket.io';
import { Main } from '..';
import { Account } from '../core/Account';
import { WebClient } from './WebClient';
import { WebSubscriptionManager } from './WebSubscriptionManager';

/**
 * Manages the socket server and handles incoming connections.
 */
export class WebManager {

	public clients = new Set<WebClient>();

	private _server: Server;
	private _subscriptionManagers = new Map<Account, WebSubscriptionManager>();

	public logger: Logger;

	public constructor() {
		this.logger = Main.logger.createLogger('web');
		this._server = new Server();

		this._server.on('connection', socket => {
			socket.once('subscribe', (accountName: string) => {
				const account = Main.accounts.find(account => account.slug === accountName);

				if (account !== undefined) {
					const address = this._getRemoteAddress(socket);
					this.logger.info('Client <%s> started a subscription to %s', address, accountName);

					const client = new WebClient(socket, account);
					this.clients.add(client);

					this.onClientConnect(client);

					socket.on('disconnect', () => {
						this.logger.info('Client <%s> disconnected', address);

						for (const feature of client.features) {
							feature.removeClient(client);
						}

						this.clients.delete(client);
						this.onClientDisconnect(client);
					});

					socket.on('subscribe', (channelName: string) => {
						this.logger.info('Client <%s> subscribed to %s', address, channelName);
						this.getSubscription(account).getFeature(channelName).addClient(client);
					});

					socket.on('unsubscribe', (channelName: string) => {
						this.logger.info('Client <%s> unsubscribed from %s', address, channelName);
						this.getSubscription(account).getFeature(channelName).removeClient(client);
					});
				}
			});
		});
	}

	/**
	 * Starts the server.
	 */
	public start() {
		for (const account of Main.accounts) {
			if (!this._subscriptionManagers.has(account)) {
				this._subscriptionManagers.set(account, new WebSubscriptionManager(this, account));
			}
		}

		this._server.listen(21457, {
			cors: {
				origin: '*'
			}
		});
	}

	/**
	 * Returns the subscription instance for the specified account.
	 *
	 * @param account
	 */
	public getSubscription(account: Account) {
		if (!this._subscriptionManagers.has(account)) {
			this._subscriptionManagers.set(account, new WebSubscriptionManager(this, account));
		}

		return this._subscriptionManagers.get(account)!;
	}

	/**
	 * Invoked when the given web client connects.
	 *
	 * @param client
	 */
	public async onClientConnect(client: WebClient) {
		const account = client.account;

		// Add the client to the relevant subscription manager
		this.getSubscription(account).addClient(client);

		// Send core account information
		client.emit('@set/accountData', {
			name: account.options.name,
			slug: account.slug
		});

		// Send initial data
		client.emit('@set/assets', await account.getAssetList());
		client.emit('@set/balance', account.getBalanceDto());

		// Send the signal that we're done initializing
		client.emit('@init/finished');

		// ----- After connecting -----
		// Send all balances every 1 second (include percent changes)
		// Send total balance every 0.2 seconds
		// ----- Subscription based -----
		// Send the selected balance and candlestick every 0.2 seconds
		// Send the selected balance's changes (percent and amount) every 1 second
	}

	/**
	 * Invoked when the given web client disconnects.
	 *
	 * @param client
	 */
	public onClientDisconnect(client: WebClient) {
		// Remove the client to the relevant subscription manager
		this.getSubscription(client.account).removeClient(client);
	}

	/**
	 * Returns the IP address of the socket.
	 *
	 * @param socket
	 * @returns
	 */
	private _getRemoteAddress(socket: Socket) {
		if ('x-forwarded-for' in socket.handshake.headers) {
			const header = socket.handshake.headers["x-forwarded-for"]!;

			if (typeof header === 'string') {
				return header.split(',')[0];
			}

			return header[0];
		}

		return socket.request.socket.remoteAddress;
	}

}
