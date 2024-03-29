import { EventEmitter, PromiseTimeoutSource } from '@baileyherbert/common';
import { AccountBalance } from './AccountBalance';

import fs from 'fs';
import path from 'path';
import { Main } from '..';
import { FileWriteAggregator } from '../util/FileWriteAggregator';
import { WebSubscriptionFeature } from '../http/WebSubscriptionFeature';

export class AccountBalanceInterval extends EventEmitter<AccountBalanceIntervalEvents> {

	public duration: number;

	private _offset: number = 0;
	private _data?: ICandleData;
	private _writer = new FileWriteAggregator(5000);

	private _feature: WebSubscriptionFeature;

	/**
	 * The index is a list of offsets that will be available on the disk. We can use it to quickly identify available
	 * data ranges and for easy cleanup of old data.
	 */
	private _index = new Array<number>();

	public constructor(public balance: AccountBalance, public interval: Interval, public retention: number) {
		super();

		this._feature = balance.account.subscription.getFeature(`chart/${this.balance.name}/${this.interval}`);
		this.duration = INTERVALS[interval];
		this._load();

		setInterval(() => this._clean(), 60000 * 5);
		setInterval(() => this._clean(), 1000);

		// Send data to subscriptions
		this._feature.on('subscribed', async client => {
			// Send the last [retention] data points
			const data = new Array<WebChartData>();
			const indexes = new Array<number>();
			const promises = new Array<Promise<ICandleData | undefined>>();

			const offsetEnd = Math.floor(Date.now() / this.duration);
			const offsetBegin = offsetEnd - this.retention;

			// Start reading all data
			for (let offset = offsetBegin; offset <= offsetEnd; offset++) {
				indexes.push(offset);
				promises.push(this.getDataAtIndex(offset));
			}

			// Wait for promises to complete
			const results = await Promise.all(promises);

			// Convert data into the applicable formats
			for (let i = 0; i < results.length; i++) {
				const candle = results[i];
				const index = indexes[i];

				data.push({
					offset: index,
					timestamp: index * this.duration,
					// @ts-ignore
					data: candle ?? {}
				});
			}

			client.emit('@chart/data', data);
		});
	}

	public push(current: number) {
		const offset = Math.floor(Date.now() / this.duration);
		let isNewMinute = false;

		// Start a new minute
		if (this._offset !== offset) {
			this._offset = offset;
			this._data = {
				open: current,
				close: current,
				high: current,
				low: current
			};
			this._index.push(offset);
			isNewMinute = true;
		}

		// Update existing minute
		else if (this._data !== undefined) {
			if (current > this._data.high) {
				this._data.high = current;
			}

			if (current < this._data.low) {
				this._data.low = current;
			}

			this._data.close = current;
		}

		const target = path.resolve(this.savePath, `${this._offset}.json`);

		this._emit('data', this._data!, this._offset);
		this._writer.write(target, JSON.stringify(this._data));

		if (isNewMinute) {
			const indexTarget = path.resolve(this.savePath, `@index.json`);
			this._writer.write(indexTarget, JSON.stringify(this._index));
		}

		// Emit to subscriptions
		if (this._feature.length > 0) {
			this._feature.emit('@chart/current', {
				offset: this._offset,
				timestamp: this._offset * this.duration,
				data: this._data
			});
		}
	}

	/**
	 * Returns candlestick data for the specified timestamp on this interval. Returns `undefined` if out of range.
	 *
	 * @param timestamp
	 */
	public async getDataAtTimestamp(timestamp: number): Promise<ICandleData | undefined> {
		const target = Math.floor(timestamp / this.duration);
		let lastApplicableIndex = -1;
		let lastApplicableOffset = -1;

		if (this._offset === target) {
			return this._data;
		}

		for (let index = 0; index < this._index.length; index++) {
			const offset = this._index[index];

			if (offset <= target) {
				lastApplicableIndex = index;
				lastApplicableOffset = offset;
			}
		}

		if (lastApplicableIndex < 0) {
			return;
		}

		const fileName = path.resolve(this.savePath, `${lastApplicableOffset}.json`);
		const data = await fs.promises.readFile(fileName);

		return JSON.parse(data.toString());
	}

	/**
	 * Returns the data at the specified index number.
	 *
	 * @param index
	 * @returns
	 */
	public async getDataAtIndex(index: number): Promise<ICandleData | undefined> {
		if (this._offset === index) {
			return this._data;
		}

		if (this._index.indexOf(index) >= 0) {
			const fileName = path.resolve(this.savePath, `${index}.json`);
			const data = await fs.promises.readFile(fileName);
			return JSON.parse(data.toString());
		}

		return;
	}

	/**
	 * Given an offset, and the amount of the asset owned at the time, recalculates, saves, and returns the candle
	 * data for that offset using historical coinbase data.
	 *
	 * @param offset
	 * @param amountAtTime
	 * @returns
	 */
	public async recalculateAt(offset: number, amountAtTime: number): Promise<ICandleData | undefined> {
		const history = await Main.ticker.getMarketPriceHistory(this.balance.name, this.interval);
		const intervalDurationMillis = Main.ticker.getSecondsFromInterval(this.interval) * 1000;

		const buys = this.balance.getBuysAt(offset * intervalDurationMillis, this.interval);
		const sells = this.balance.getSellsAt(offset * intervalDurationMillis, this.interval);

		let amountAtOpen = amountAtTime;
		let amountAtClose = amountAtTime;

		for (const buy of buys) {
			amountAtOpen -= buy.quantity;
		}

		for (const sell of sells) {
			amountAtClose -= sell.quantity;
		}

		for (const candle of history) {
			const cOffset = Math.floor(candle.openTimeInMillis / intervalDurationMillis);

			if (cOffset === offset) {
				const data: ICandleData = {
					open: candle.open * amountAtOpen,
					high: candle.high * amountAtTime,
					low: candle.low * amountAtTime,
					close: candle.close * amountAtClose
				};

				if (data.open < data.low) data.low = data.open;
				if (data.close < data.low) data.low = data.close;

				this.correct(offset, data);

				return data;
			}
		}

		return;
	}

	public correct(offset: number, data: ICandleData) {
		const target = path.resolve(this.savePath, `${offset}.json`);

		if (fs.existsSync(target)) {
			this._writer.write(target, JSON.stringify(data));

			if (this._feature.length > 0) {
				this._feature.emit('@chart/correction', {
					name: this.balance.name,
					interval: this.interval,
					offset,
					timestamp: this.duration * offset,
					data
				});
			}
		}
	}

	private _load() {
		const offset = Math.floor(Date.now() / this.duration);
		const target = path.resolve(this.savePath, `${offset}.json`);
		const indexTarget = path.resolve(this.savePath, `@index.json`);

		if (fs.existsSync(target)) {
			try {
				this._offset = offset;
				this._data = JSON.parse(fs.readFileSync(target).toString());
			}
			catch (err) {
				console.error('!! FAILED TO LOAD INTERVAL DATA !!');
				console.error('This likely means the process was terminated while saving the data.');
				console.error('It also means you\'re about to hate yourself for not implementing save journals. :)');
				console.error(err);
			}
		}

		if (fs.existsSync(indexTarget)) {
			this._index = JSON.parse(fs.readFileSync(indexTarget).toString());
		}
	}

	private async _clean() {
		const currentOffset = Math.floor(Date.now() / this.duration);
		const minimumOffset = currentOffset - this.retention;

		const preserved = new Array<number>();
		const removed = new Array<number>();

		for (const offset of this._index) {
			if (offset < minimumOffset) {
				removed.push(offset);
			}
			else {
				const target = path.resolve(this.savePath, `${offset}.json`);

				if (!await fileExists(target)) {
					console.log('Removing interval file because it does not exist:', target);
					removed.push(offset);
					continue;
				}

				preserved.push(offset);
			}
		}

		if (removed.length > 0) {
			this._index = preserved;

			for (const offset of removed) {
				const target = path.resolve(this.savePath, `${offset}.json`);

				if (await fileExists(target)) {
					try {
						await fs.promises.unlink(target);
					}
					catch (err) {}
				}
			}

			const indexTarget = path.resolve(this.savePath, `@index.json`);
			this._writer.write(indexTarget, JSON.stringify(this._index));
		}
	}

	private _internalSavePathCache?: string;
	public get savePath() {
		if (!this._internalSavePathCache) {
			this._internalSavePathCache = path.resolve(this.balance.savePath, this.interval);

			if (!fs.existsSync(this._internalSavePathCache)) {
				fs.mkdirSync(this._internalSavePathCache, { recursive: true });
			}
		}

		return this._internalSavePathCache;
	}

}

const INTERVALS = {
	'1m': 60000,
	'5m': 60000 * 5,
	'15m': 60000 * 15,
	'1h': 60000 * 60,
	'6h': 60000 * 60 * 6,
	'1d': 60000 * 60 * 24
}

export type Interval = '1m' | '5m' | '15m' | '1h' | '6h' | '1d';

export interface ICandleData {
	open: number;
	close: number;
	high: number;
	low: number;
}

type AccountBalanceIntervalEvents = {
	data: [data: ICandleData, offset: number];
}

export interface WebChartData {
	offset: number;
	timestamp: number;
	data: {
		open: number;
		close: number;
		high: number;
		low: number;
	}
}

async function fileExists(file: string) {
	return fs.promises.access(file, fs.constants.F_OK)
           .then(() => true)
           .catch(() => false)
}
