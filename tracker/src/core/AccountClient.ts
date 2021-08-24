import { Account } from './Account';
import { CoinbasePro, Profile, Account as CryptoAccount } from 'coinbase-pro-node';
import { EventEmitter } from '@baileyherbert/common';
import { TransferType } from 'coinbase-pro-node/dist/transfer';

/**
 * Manages the underlying Coinbase client and facilitates subscription data.
 */
export class AccountClient extends EventEmitter<ClientEvents> {

	private _client: CoinbasePro;

	public constructor(public account: Account) {
		super();

		this._client = new CoinbasePro({
			apiKey: account.options.apiKey,
			apiSecret: account.options.apiSecret,
			passphrase: account.options.apiPassphrase,
			useSandbox: false
		});
	}

	public async getDefaultPortfolio(): Promise<Profile | undefined> {
		const profiles = await this._client.rest.profile.listProfiles();

		for (const profile of profiles) {
			if (profile.name === 'default' && profile.active) {
				return profile;
			}
		}

		return;
	}

	public async getAccountList(): Promise<CryptoAccount[]> {
		return await this._client.rest.account.listAccounts();
	}

	public async getFills(productId: string) {
		return await this._client.rest.fill.getFillsByProductId(productId);
	}

}

type ClientEvents = {
	ticker: [data: ITickerEvent];
}

export interface ITickerEvent {
	type: 'ticker';
	product_id: string;
	price: string;
	open_24h: string;
	volume_24h: string;
	low_24h: string;
	high_24h: string;
	volume_30d: string;
	best_bid: string;
	best_ask: string;
	side: 'buy' | 'sell';
	time: string;
	trade_id: number;
	last_size: string;
}
