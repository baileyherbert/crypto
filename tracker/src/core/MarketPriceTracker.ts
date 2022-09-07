import { Main } from '..';
import { WebClient } from '../http/WebClient';
import { Account } from './Account';
import { Interval, WebChartData } from './AccountBalanceInterval';

/**
 * This class interacts with the Coinbase API to provide web clients with historical and real time market prices on
 * request and without any local storage.
 */
export class MarketPriceTracker {

	/**
	 * The clients who want to receive market data along with their subscribed interval.
	 */
	private _clients = new Map<WebClient, Interval>();

	/**
	 * The intervals and a list of their subscribers (just an alternative to the subscribers map).
	 */
	private _clientIntervals = new Map<Interval, Set<WebClient>>();

	private _intervals = new Map<Interval, ICandleData>();

	private _intervalHistory = new Map<Interval, Map<number, ICandleData>>();
	private _intervalHistoryIndex = new Map<Interval, Array<number>>();

	/**
	 * @param name The name of the asset to track (such as `ADA-USD`)
	 */
	public constructor(public name: string) {

	}

	/**
	 * Subscribes the given client to the tracker for the given interval. If the client is already subscribed, the
	 * interval will be updated.
	 *
	 * This method will automatically send initial data to the client and begin sending regular updates as new data
	 * becomes available.
	 *
	 * @param client
	 * @param interval
	 */
	public async subscribe(client: WebClient, interval: Interval) {
		// Remove the old interval for an existing client
		if (this._clients.has(client)) {
			this._clientIntervals.get(this._clients.get(client)!)?.delete(client);
		}

		// Add or update the subscriber and their interval
		this._clients.set(client, interval);

		// Create the interval set if needed
		if (!this._clientIntervals.has(interval)) {
			this._clientIntervals.set(interval, new Set());
		}

		// Add the client to the interval
		this._clientIntervals.get(interval)?.add(client);

		// Get initial data
		const history = await Main.ticker.getMarketPriceHistory(this.name, interval);
		const intervalDurationMillis = Main.ticker.getSecondsFromInterval(interval) * 1000;
		const data = new Array<WebChartData>();
		const currentInterval = this._intervals.get(interval);
		let lastOffset = 0;

		for (const candle of history) {
			const offset = lastOffset = Math.floor(candle.openTimeInMillis / intervalDurationMillis);

			// If we have historical data for this offset, use it instead
			if (this._intervalHistory.get(interval)?.has(offset)) {
				data.push(this._intervalHistory.get(interval)?.get(offset)!);
				continue;
			}

			// If we are currently tracking this offset, combine the data
			if (currentInterval !== undefined && currentInterval.offset === offset) {
				if (candle.high > currentInterval.data.high) currentInterval.data.high = candle.high;
				if (candle.low < currentInterval.data.low) currentInterval.data.low = candle.low;

				data.push(currentInterval);
				continue;
			}

			data.push({
				offset,
				timestamp: candle.openTimeInMillis,
				data: {
					close: candle.close,
					open: candle.open,
					high: candle.high,
					low: candle.low,
				}
			});
		}

		// Check if we have data newer than the last offset
		if (this._intervalHistory.has(interval)) {
			const existing = [...this._intervalHistory.get(interval)?.values()!, this._intervals.get(interval)!];

			for (const item of existing) {
				if (item.offset > lastOffset) {
					data.push(item);
				}
			}
		}

		client.emit('@chart/data', data);
	}

	/**
	 * Unsubscribes the given client from the tracker.
	 *
	 */
	public unsubscribe(client: WebClient) {
		if (this._clients.has(client)) {
			this._clientIntervals.get(this._clients.get(client)!)?.delete(client);
			this._clients.delete(client);
		}
	}

	/**
	 * Registers an account on the tracker and begins listening for subscriptions. This is required due to how the
	 * subscription system is currently designed, where web clients can only subscribe through an account.
	 *
	 * @param account
	 */
	public registerAccount(account: Account) {
		for (const interval of INTERVALS) {
			const feature = account.subscription.getFeature(`chart/${this.name}/${interval}/market`);

			feature.on('subscribed', client => {
				this.subscribe(client, interval);
			});

			feature.on('unsubscribed', client => {
				this.unsubscribe(client);
			});
		}
	}

	/**
	 * Updates the current price from the ticker.
	 *
	 * @param price
	 */
	public updateTickerPrice(price: number) {
		for (const interval of INTERVALS) {
			const candle = this._intervals.get(interval);
			const duration = (Main.ticker.getSecondsFromInterval(interval) * 1000);
			const offset = Math.floor(Date.now() / duration);
			const timestamp = offset * duration;

			// Start a new candle when the offset changes
			if (candle === undefined || candle.offset !== offset) {
				this._intervals.set(interval, {
					offset,
					timestamp,
					data: {
						open: price,
						close: price,
						high: price,
						low: price
					}
				});

				// Record the old data in the history
				// This is necessary because the Coinbase API won't return data for the last couple of minutes
				if (candle !== undefined) {
					if (!this._intervalHistoryIndex.has(interval)) {
						this._intervalHistoryIndex.set(interval, []);
						this._intervalHistory.set(interval, new Map());
					}

					this._intervalHistoryIndex.get(interval)?.push(candle.offset);
					this._intervalHistory.get(interval)?.set(candle.offset, candle);

					// Remove old data
					if (this._intervalHistoryIndex.get(interval)!.length > 5) {
						const target = this._intervalHistoryIndex.get(interval)?.shift()!;
						this._intervalHistory.get(interval)?.delete(target);
					}
				}
			}

			// Otherwise update the existing candle
			else {
				candle.data.close = price;

				if (price > candle.data.high) {
					candle.data.high = price;
				}

				if (price < candle.data.low) {
					candle.data.low = price;
				}
			}

			// Alert subscribers
			const subscribers = this._clientIntervals.get(interval);
			if (subscribers !== undefined) {
				for (const client of subscribers) {
					client.emit('@chart/current', this._intervals.get(interval)!);
				}
			}
		}
	}

}

interface ICandleData {
	offset: number;
	timestamp: number;
	data: {
		open: number;
		close: number;
		high: number;
		low: number;
	}
}

export const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '6h', '1d'];
