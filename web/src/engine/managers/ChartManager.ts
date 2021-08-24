import { EventEmitter } from '@baileyherbert/common';
import type { WebChartData, WebChartType } from '../models/WebChart';
import { createStore } from '../util/stores';
import type { WebEngine } from '../WebEngine';

/**
 * This class helps the web client receive and implement chart data.
 *
 * The chart library used for balance visualization is very strict about how data is inserted, deleted, and updated.
 * For this reason we can better optimize the application by managing the data ourselves without stores.
 */
export class ChartManager extends EventEmitter<ChartManagerEvents> {

	/**
	 * A store containing the current chart interval.
	 */
	public interval = createStore<Interval>('1m');

	/**
	 * A store containing the current chart channel, which will be either `@total` or the full token of a currency like
	 * `ADA-USD`.
	 */
	public channel = createStore<string>('@total');

	/**
	 * A store containing the current type of chart.
	 */
	public type = createStore<WebChartType>('balance');

	/**
	 * A store containing the most recent tick on the chart which will be updated with high frequency.
	 */
	public chartCurrentTick = createStore<WebChartData | undefined>(undefined);

	/**
	 * A store containing full chart data.
	 */
	public chartData = createStore<WebChartData[]>([]);

	/**
	 * The name of the current subscription.
	 */
	private _currentSubscribeName?: string;

	public constructor(private engine: WebEngine) {
		super();
	}

	/**
	 * Updates the current interval tick on the chart data.
	 *
	 * @param dto
	 */
	public updateChartCurrent(dto: WebChartData) {
		this.chartCurrentTick.set(dto);
	}

	/**
	 * Updates the current interval tick on the chart data.
	 *
	 * @param dto
	 */
	public updateChartData(dto: WebChartData[]) {
		this.chartData.set(dto);
	}

	/**
	 * Switches the chart to the specified interval.
	 *
	 * @param interval
	 */
	public setInterval(interval: Interval) {
		if (this.interval.get() === interval) {
			return;
		}

		this.interval.set(interval);
		this.chartCurrentTick.set(undefined);
		this.chartData.set([]);

		this._subscribe();
	}

	/**
	 * Switches the chart to the specified channel.
	 *
	 * @param channel
	 */
	public setChannel(channel: string) {
		if (this.channel.get() === channel) {
			return;
		}

		this.channel.set(channel);
		this.type.set('balance');
		this.chartCurrentTick.set(undefined);
		this.chartData.set([]);

		this._subscribe();
	}

	/**
	 * Switches the chart to the specified type.
	 *
	 * @param channel
	 */
	public setType(type: WebChartType) {
		if (this.type.get() === type) {
			return;
		}

		this.type.set(type);
		this.chartCurrentTick.set(undefined);
		this.chartData.set([]);

		this._subscribe();
	}

	/**
	 * Initializes the chart on the specified channel and interval.
	 *
	 * @param channel
	 * @param interval
	 */
	public init(channel: string, interval: Interval, type: WebChartType) {
		this.channel.set(channel);
		this.interval.set(interval);
		this.type.set(type);
		this.chartCurrentTick.set(undefined);
		this.chartData.set([]);

		this._subscribe();
	}

	/**
	 * Sends a subscription request for the current channel, type, and interval. Automatically unsubscribes from an
	 * existing subscription if needed.
	 */
	private _subscribe() {
		const newSubscribeName = `chart/${this.channel.get()}/${this.interval.get()}`
			+ (this.type.get() === 'market' ? '/market' : '');

		// Return if the channel has not changed
		if (this._currentSubscribeName === newSubscribeName) {
			return;
		}

		// Unsubscribe from the existing channel
		if (this._currentSubscribeName) {
			this.engine.socket.emit('unsubscribe', this._currentSubscribeName);
		}

		// Build the new subscription name
		this._currentSubscribeName = newSubscribeName;

		// Send the subscribe request
		this.engine.socket.emit('subscribe', newSubscribeName);
	}

}

type ChartManagerEvents = {
	/**
	 * Emitted when we have full data available for the chart. In this case the entire chart should be rerendered with
	 * this data.
	 */
	chartData: [];

	/**
	 *
	 */
	chartCurrentTickData: [];
};

export type Interval = '1m' | '5m' | '15m' | '1h' | '6h' | '1d';
