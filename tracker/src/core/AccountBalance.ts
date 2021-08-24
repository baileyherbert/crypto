import { EventEmitter } from '@baileyherbert/common';
import { Account, AssetOrder, AssetPrice } from './Account';
import { AccountBalanceInterval, Interval } from './AccountBalanceInterval';
import path from 'path';
import fs from 'fs';

/**
 * This class represents an individual balance, such as for a crypto, total balance, etc. It also records historical
 * balance data in memory and to the disk.
 */
export class AccountBalance extends EventEmitter<AccountBalanceEvents> {

	private _price = 0;
	private _amount = 0;
	private _lastUSD = 0;

	private _intervals = new Map<Interval, AccountBalanceInterval>();
	private _history = new Array<ITradeHistory>();

	private _loaded = false;
	private _lastAmount = -1;

	public doSaveAmount = true;

	public autoCommit = true;

	public constructor(public account: Account, public name: string) {
		super();

		const historyPath = path.resolve(this.savePath, '@history.json');
		const amountPath = path.resolve(this.savePath, '@amount.json');

		if (fs.existsSync(historyPath)) {
			this._history = JSON.parse(fs.readFileSync(historyPath).toString());
		}

		if (fs.existsSync(amountPath)) {
			this._amount = JSON.parse(fs.readFileSync(amountPath).toString());
			this._lastAmount = this._amount;
			this._loaded = true;
		}

		this._intervals.set('1m', new AccountBalanceInterval(this, '1m', 360));
		this._intervals.set('5m', new AccountBalanceInterval(this, '5m', 144));
		this._intervals.set('15m', new AccountBalanceInterval(this, '15m', 144));
		this._intervals.set('1h', new AccountBalanceInterval(this, '1h', 168));
		this._intervals.set('6h', new AccountBalanceInterval(this, '6h', 112));
		this._intervals.set('1d', new AccountBalanceInterval(this, '1d', 64));
	}

	public get amount() {
		return this._amount;
	}

	/**
	 * Records the current price per unit.
	 *
	 * @param price
	 */
	public recordPrice(price: number) {
		if (price !== this._price) {
			this._price = price;
			this.autoCommit && this.commit();
		}
	}

	/**
	 * Records the current amount of units.
	 *
	 * @param amount
	 */
	public recordAmount(amount: number) {
		if (amount !== this._amount) {
			this._amount = amount;
			this.autoCommit && this.commit();
		}
	}

	/**
	 * Records both the current price and the amount at once.
	 *
	 * @param price
	 * @param amount
	 */
	public record(price: number, amount: number) {
		const changed = this._amount !== amount || this._price !== price;

		if (this._amount !== amount) {
			this._amount = amount;
		}

		if (this._price !== price) {
			this._price = price;
		}

		if (changed) {
			this.autoCommit && this.commit();
		}
	}

	/**
	 * Writes the latest dollar total to the intervals and emits events.
	 */
	public commit() {
		const usd = this.usd;

		if (usd !== this._lastUSD) {
			this._lastUSD = usd;
			this._emit('balance', usd);

			for (const interval of this._intervals.values()) {
				interval.push(usd);
			}
		}

		if (this._lastAmount !== this._amount) {
			const last = this._lastAmount;
			this._lastAmount = this._amount;
			this.fetchFillsFromAccount();

			if (this.doSaveAmount) {
				// Save the amount to the file
				const amountPath = path.resolve(this.savePath, '@amount.json');
				fs.promises.writeFile(amountPath, JSON.stringify(this._amount));

				//  Emit an event to show the quantity change
				this._emit('quantity', this._amount, last);
			}
		}

		this._loaded = true;
	}

	/**
	 * The current value of this balance in USD.
	 */
	public get usd() {
		return +(this._amount * this._price).toFixed(4);
	}

	/**
	 * Returns the specified interval tracker.
	 *
	 * @param interval
	 * @returns
	 */
	public getInterval(interval: Interval) {
		return this._intervals.get(interval)!;
	}

	/**
	 * Returns the opening amount 1 hour ago.
	 */
	public async getOpenAmount1H() {
		const target = Date.now() - 3600000;
		const data = await this.getInterval('5m').getDataAtTimestamp(target);

		return data?.open;
	}

	/**
	 * Returns the opening amount 1 day ago.
	 */
	public async getOpenAmount1D() {
		const target = Date.now() - 86400000;
		const data = await this.getInterval('1h').getDataAtTimestamp(target);

		return data?.open;
	}

	/**
	 * Returns the opening amount 1 week ago.
	 */
	public async getOpenAmount1W() {
		const target = Date.now() - (86400000 * 7);
		const data = await this.getInterval('6h').getDataAtTimestamp(target);

		return data?.open;
	}

	/**
	 * Returns the opening amount 1 month ago.
	 */
	public async getOpenAmount1M() {
		const target = Date.now() - (86400000 * 30);
		const data = await this.getInterval('1d').getDataAtTimestamp(target);

		return data?.open;
	}

	/**
	 * Returns the opening amount for the specified interval.
	 *
	 * @param interval
	 * @returns
	 */
	public async getOpenAmountInterval(interval: HistoryInterval) {
		switch (interval) {
			case '1h': return this.getOpenAmount1H();
			case '1d': return this.getOpenAmount1D();
			case '1w': return this.getOpenAmount1W();
			case '1m': return this.getOpenAmount1M();
		}
	}

	/**
	 * Returns the opening amounts for 1 hour, 1 day, 1 week, and 1 month ago. This is ideal for fetching all at once
	 * because it will execute the file reads simultaneously.
	 *
	 * @returns
	 */
	public async getOpenAmounts() {
		const results = await Promise.all([
			this.getOpenAmount1H(),
			this.getOpenAmount1D(),
			this.getOpenAmount1W(),
			this.getOpenAmount1M()
		]);

		return {
			hour: results[0],
			day: results[1],
			week: results[2],
			month: results[3],
		};
	}

	/**
	 * Returns the balance as an asset price object.
	 *
	 * @returns
	 */
	public async getAssetPrice(): Promise<AssetPrice> {
		const dollars = this.usd;
		const dollarsBefore = (await this.getOpenAmount1D()) ?? 0;
		const difference = dollars - dollarsBefore;
		const trend = difference > 0 ? 'up' : (difference === 0 ? 'none' : 'down');
		const trendAmountDollars = +difference.toFixed(4);
		const trendAmountPercent = +((dollars / dollarsBefore - 1) * 100).toFixed(4);

		return {
			dollars,
			trend,
			trendAmountDollars,
			trendAmountPercent
		};
	}

	/**
	 * Returns growth of the balance over the given interval as an asset price object.
	 *
	 * @param interval
	 * @returns
	 */
	public async getGrowthAssetPrice(interval: HistoryInterval): Promise<AssetPrice | undefined> {
		const dollars = this.usd;
		const dollarsBefore = await this.getOpenAmountInterval(interval);

		if (dollarsBefore === undefined) {
			return;
		}

		const difference = dollars - dollarsBefore;
		const trend = difference > 0 ? 'up' : (difference === 0 ? 'none' : 'down');
		const trendAmountDollars = +difference.toFixed(4);
		const trendAmountPercent = +((dollars / dollarsBefore - 1) * 100).toFixed(4);

		return {
			dollars,
			trend,
			trendAmountDollars,
			trendAmountPercent
		};
	}

	/**
	 * Updates the history for this balance.
	 *
	 * @returns
	 */
	public async fetchFillsFromAccount() {
		if (this.name === '@total' || this.name === 'USD') {
			return;
		}

		try {
			const response = await this.account.client.getFills(this.name);
			const fills = response.data.reverse();

			let numNewFills = 0;

			for (const fill of fills) {
				if (!fill.settled) {
					setTimeout(() => this.fetchFillsFromAccount(), 5000);
					break;
				}

				if (this._history.find(h => h.id === fill.order_id) === undefined) {
					const amount = (+fill.size) * (fill.side === 'buy' ? 1 : -1);
					const price = +(+fill.price).toFixed(4);
					const timestamp = Date.parse(fill.created_at);

					this._history.push({
						id: fill.order_id,
						timestamp,
						amount,
						price
					});

					this.account.logger.info(
						'Got new fill (%s) for %d %s at $%s',
						fill.side,
						amount.toFixed(4),
						this.name,
						price.toFixed(4)
					);

					numNewFills++;
				}
			}

			if (numNewFills > 0) {
				const historyPath = path.resolve(this.savePath, '@history.json');
				await fs.promises.writeFile(historyPath, JSON.stringify(this._history));

				// TODO: Emit an event to web clients who are subscribed to this user
			}
		}
		catch (err) {
			this.account.logger.error(err);
		}
	}

	/**
	 * Returns an array of buy orders on this balance.
	 *
	 * @returns
	 */
	public getBuyOrders(): AssetOrder[] {
		const orders = new Array<AssetOrder>();

		for (const item of this._history.values()) {
			if (item.amount > 0) {
				orders.push({
					quantity: item.amount,
					price: item.price,
					amount: (item.price * item.amount),
					timestamp: item.timestamp
				});
			}
		}

		return orders;
	}

	/**
	 * Returns an array of sell orders on this balance.
	 *
	 * @returns
	 */
	public getSellOrders(): AssetOrder[] {
		const orders = new Array<AssetOrder>();

		for (const item of this._history.values()) {
			if (item.amount < 0) {
				orders.push({
					quantity: Math.abs(item.amount),
					price: item.price,
					amount: (item.price * Math.abs(item.amount)),
					timestamp: item.timestamp
				});
			}
		}

		return orders;
	}

	private _internalSavePathCache?: string;
	public get savePath() {
		if (!this._internalSavePathCache) {
			this._internalSavePathCache = path.resolve(this.account.savePath, this.name.toLowerCase());

			if (!fs.existsSync(this._internalSavePathCache)) {
				fs.mkdirSync(this._internalSavePathCache, { recursive: true });
			}
		}

		return this._internalSavePathCache;
	}

}

type AccountBalanceEvents = {
	balance: [current: number];
	quantity: [current: number, previous: number];
}

export interface ITradeHistory {
	/**
	 * The order ID.
	 */
	id: string;

	/**
	 * Epoch millisecond timestamp.
	 */
	timestamp: number;

	/**
	 * The amount that was traded. This will be positive if more currency was gained, and negative if lost.
	 */
	amount: number;

	/**
	 * The price of the currency during this trade.
	 */
	price: number;
}

export type HistoryInterval = '1h' | '1d' | '1w' | '1m';
