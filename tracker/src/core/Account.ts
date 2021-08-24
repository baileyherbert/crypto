import { Main } from '..';
import { AccountBalance } from './AccountBalance';
import { AccountClient } from './AccountClient';
import path from 'path';
import fs from 'fs';
import { Logger } from '@baileyherbert/common';
import { WebSubscriptionManager } from '../http/WebSubscriptionManager';

/**
 * The account class represents a single user and portfolio combination. It requires its own key.
 */
export class Account {

	public client: AccountClient;
	public balances = new Map<string, AccountBalance>();
	public totalBalance: AccountBalance;

	public logger: Logger;
	public subscription: WebSubscriptionManager;

	public constructor(public options: IAccountOptions) {
		this.logger = Main.logger.createLogger('account:' + this.slug);
		this.client = new AccountClient(this);
		this.subscription = Main.web.getSubscription(this);

		this.totalBalance = new AccountBalance(this, '@total');
		this.totalBalance.doSaveAmount = false;
		this.totalBalance.autoCommit = false;
		this.totalBalance.recordPrice(1);
	}

	public async start() {
		const accounts = await this.client.getAccountList();

		for (const account of accounts) {
			const name = account.currency + (account.currency !== 'USD' ? '-USD' : '');

			if (Main.ticker.options.currencies.indexOf(name) >= 0 || name === 'USD') {
				const balance = new AccountBalance(this, name);
				const price = Main.ticker.getPrice(name);

				balance.record(price, +account.balance);
				this.balances.set(name, balance);

				balance.on('balance', () => this._recalculateTotalBalance());
			}
		}

		Main.ticker.on('change', (currency, price) => {
			if (this.balances.has(currency)) {
				this.balances.get(currency)?.recordPrice(price);
			}
		});

		// Initial total calculation
		this.totalBalance.autoCommit = true;
		this._recalculateTotalBalance();

		// Check balance amounts every 5 seconds
		setInterval(() => this._updateBalances(), 5000);

		// Check for new fills
		for (const balance of this.balances.values()) {
			balance.fetchFillsFromAccount();
		}

		// Emit total balance changes
		this.totalBalance.on('balance', () => {
			if (this.subscription.length > 0) {
				this.subscription.emit('@set/balance', this.getBalanceDto());
			}
		});

		// Emit balance changes
		for (const manager of this.balances.values()) {
			const fullTicker = manager.name;
			const ticker: string = fullTicker.substring(0, 3);
			const name = Main.getCryptoName(ticker);

			// Notify clients when balance changes
			manager.on('balance', async () => {
				if (this.subscription.length > 0) {
					const promises = await Promise.all([
						manager.getAssetPrice(),
						manager.getGrowthAssetPrice('1h'),
						manager.getGrowthAssetPrice('1d'),
						manager.getGrowthAssetPrice('1w'),
						manager.getGrowthAssetPrice('1m')
					]);

					this.subscription.emit('@update/asset', {
						ticker,
						name,
						quantity: +manager.amount.toFixed(8),
						price: Main.ticker.getAssetPrice(fullTicker),
						balance: promises[0],
						growthHour: promises[1],
						growthDay: promises[2],
						growthWeek: promises[3],
						growthMonth: promises[4]
					});
				}
			});

			// Notify clients when quantity changes
			// We should resend full portfolio if we're entering or leaving the $1 barrier
			manager.on('quantity', async (current, previous) => {
				if ((previous < 1 && current >= 1) || (previous >= 1 && current < 1)) {
					if (this.subscription.length > 0) {
						this.subscription.emit('@set/assets', await this.getAssetList());
					}
				}
			});
		}

		this.logger.info('Account started.');
	}

	private async _updateBalances() {
		try {
			const accounts = await this.client.getAccountList();

			for (const account of accounts) {
				const name = account.currency + (account.currency !== 'USD' ? '-USD' : '');

				if (this.balances.has(name)) {
					this.balances.get(name)?.recordAmount(+account.balance);
				}
			}
		}
		catch (err) {
			this.logger.error(err);
		}
	}

	private _recalculateTotalBalance() {
		let total = 0;

		for (const balance of this.balances.values()) {
			total += balance.usd;
		}

		this.totalBalance.recordAmount(total);
	}

	public get slug() {
		return this.options.name.toLowerCase().trim();
	}

	/**
	 * Builds a balance object for the web interface.
	 *
	 * @returns
	 */
	public getBalanceDto() {
		return {
			dollars: this.totalBalance.usd
		};
	}

	/**
	 * Generates and returns the sorted asset list for this account with starter data.
	 */
	public async getAssetList() {
		const assets = new Array<Asset>();

		for (const fullTicker of [...Main.config.ticker.currencies, 'USD']) {
			const ticker: string = fullTicker.substring(0, 3);
			const name = Main.getCryptoName(ticker);
			const manager = this.balances.get(fullTicker);

			if (manager === undefined) {
				this.logger.error('Missing balance for', fullTicker, ticker);
				continue;
			}

			const promises = await Promise.all([
				manager.getAssetPrice(),
				manager.getGrowthAssetPrice('1h'),
				manager.getGrowthAssetPrice('1d'),
				manager.getGrowthAssetPrice('1w'),
				manager.getGrowthAssetPrice('1m')
			]);

			if (promises[0].dollars < 1) {
				continue;
			}

			assets.push({
				ticker,
				name,
				quantity: +manager.amount.toFixed(8),
				price: Main.ticker.getAssetPrice(fullTicker),
				balance: promises[0],
				growthHour: promises[1],
				growthDay: promises[2],
				growthWeek: promises[3],
				growthMonth: promises[4],
				buys: manager.getBuyOrders(),
				sells: manager.getSellOrders()
			});
		}

		// Resort assets by balance
		assets.sort((a, b) => {
			if (a.balance.dollars < b.balance.dollars) return 1;
			if (a.balance.dollars > b.balance.dollars) return -1;
			return 0;
		});

		return assets;
	}

	private _internalSavePathCache?: string;
	public get savePath() {
		if (!this._internalSavePathCache) {
			this._internalSavePathCache = path.resolve(Main.rootdir, 'storage', this.slug);

			if (!fs.existsSync(this._internalSavePathCache)) {
				fs.mkdirSync(this._internalSavePathCache, { recursive: true });
			}
		}

		return this._internalSavePathCache;
	}

}

export interface IAccountOptions {
	name: string;
	apiKey: string;
	apiSecret: string;
	apiPassphrase: string;
}

export interface Asset {
	ticker: string;
	name: string;
	quantity: number;
	price: AssetPrice;
	balance: AssetPrice;
	growthHour?: AssetPrice;
	growthDay?: AssetPrice;
	growthWeek?: AssetPrice;
	growthMonth?: AssetPrice;
	buys: AssetOrder[];
	sells: AssetOrder[];
}

export interface AssetPrice {
	dollars: number;
	trend: 'up' | 'down' | 'none';
	trendAmountDollars: number;
	trendAmountPercent: number;
}

export interface AssetOrder {
	quantity: number;
	price: number;
	amount: number;
	timestamp: number;
}
