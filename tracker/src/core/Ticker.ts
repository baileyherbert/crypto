import { Account, AssetPrice } from './Account';
import { CoinbasePro, WebSocketChannelName, WebSocketEvent } from 'coinbase-pro-node';
import { EventEmitter, PromiseCompletionSource } from '@baileyherbert/common';
import { Main } from '..';
import { Interval } from './AccountBalanceInterval';

/**
 * This class tracks the current trading price of all applicable currencies and emits changes as events.
 */
export class Ticker extends EventEmitter<TickerEvents> {

	private _client: CoinbasePro;
	private _prices: Map<string, number>;
	private _24hrs: Map<string, number>;

	private _init: Set<string>;
	private _initPromise?: PromiseCompletionSource<void>;

	public logger = Main.logger.createLogger('ticker');

	public constructor(public options: ITickerOptions) {
		super();

		this._prices = new Map();
		this._24hrs = new Map();
		this._init = new Set(options.currencies);

		this._client = new CoinbasePro({
			apiKey: options.apiKey,
			apiSecret: options.apiSecret,
			passphrase: options.apiPassphrase,
			useSandbox: false
		});

		this._client.ws.on(WebSocketEvent.ON_MESSAGE, message => {
			if (message.type === 'ticker') {
				const productId = message.product_id as string;
				const price = +message.price;
				const price24h = +message.open_24h;
				const lastPrice = this._prices.get(productId) ?? 0;

				this._prices.set(productId, price);
				this._24hrs.set(productId, price24h);

				if (this._initPromise !== undefined) {
					if (this._init.has(productId)) {
						this._init.delete(productId);

						if (this._init.size === 0) {
							this._initPromise.setResult();
							this._initPromise = undefined;

							this.logger.info('Finished fetching initial data!');
						}
					}

					return;
				}

				if (price !== lastPrice) {
					this._emit('change', productId, price, this._24hrs.get(productId)!);
				}
			}
		});
	}

	/**
	 * Gets the current price for the specified currency.
	 *
	 * @param name
	 * @returns
	 */
	public getPrice(name: string) {
		if (this._prices.has(name)) {
			return this._prices.get(name)!;
		}

		if (name === 'USD') {
			return 1;
		}

		throw new Error('Unknown name: ' + name);
	}

	/**
	 * Gets the price from 24 hours ago for the specified currency.
	 *
	 * @param name
	 * @returns
	 */
	public getPrice24h(name: string) {
		if (this._24hrs.has(name)) {
			return this._24hrs.get(name)!;
		}

		if (name === 'USD') {
			return 1;
		}

		throw new Error('Unknown name: ' + name);
	}

	/**
	 * Returns the candles for the specified asset and interval.
	 *
	 * @param name
	 * @param interval
	 * @returns
	 */
	public getMarketPriceHistory(name: string, interval: Interval) {
		const start = new Date(Date.now() - (this.getSecondsFromInterval(interval) * 1000 * 300));
		const end = new Date(Date.now());

		return this._client.rest.product.getCandles(name, {
			granularity: this.getSecondsFromInterval(interval),
			start: start.toISOString(),
			end: end.toISOString()
		});
	}

	/**
	 * Converts an interval into its seconds equivalent (60, 300, 900, 3600, etc).
	 *
	 * @param interval
	 * @returns
	 */
	public getSecondsFromInterval(interval: Interval) {
		switch (interval) {
			case '1m': return 60;
			case '5m': return 300;
			case '15m': return 900;
			case '1h': return 3600;
			case '6h': return 21600;
			case '6h': return 21600;
			case '1d': return 86400;
		}
	}

	/**
	 * Returns the full asset price object for the given currency.
	 *
	 * @param name
	 * @returns
	 */
	public getAssetPrice(name: string): AssetPrice {
		const dollars = this.getPrice(name);
		const dollarsBefore = this.getPrice24h(name);
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
	 * Starts the ticker.
	 *
	 * @returns
	 */
	 public start() {
		this.logger.info('Starting ticker...');

		this._initPromise = new PromiseCompletionSource();

		this._client.ws.on(WebSocketEvent.ON_OPEN, () => {
			this._client.ws.subscribe({
				name: WebSocketChannelName.TICKER,
				product_ids: this.options.currencies
			});

			if (this._initPromise !== undefined) {
				this.logger.info('Waiting for initial data...');
			}
		});

		this._client.ws.on(WebSocketEvent.ON_ERROR, err => {
			this.logger.error(err.message, err.error);
		});

		this._client.ws.connect();
		return this._initPromise.promise;
	}

	/**
	 * The currencies that the ticker is listening to.
	 */
	public get currencies() {
		return this.options.currencies;
	}

}

type TickerEvents = {
	change: [currency: string, price: number, change24hr: number];
};

export interface ITickerOptions {
	apiKey: string;
	apiSecret: string;
	apiPassphrase: string;
	currencies: string[];
}
