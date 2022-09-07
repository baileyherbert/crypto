import io, { Socket } from 'socket.io-client';
import type { WebAssetDto } from './dtos/WebAssetDto';
import type { WebBalanceDto } from './dtos/WebBalanceDto';
import { ChartManager } from './managers/ChartManager';
import type { WebChartCorrection, WebChartData } from './models/WebChart';
import { WebState } from './WebState';
import { WebTransformer } from './WebTransformer';

export class WebEngine {

	public socket: Socket;
	public transformer: WebTransformer;
	public state: WebState;
	public chart: ChartManager;

	public constructor(public options: IWebEngineOptions) {
		this.transformer = new WebTransformer();
		this.state = new WebState();
		this.chart = new ChartManager(this);
	}

	/**
	 * Starts the backend connection.
	 */
	public start() {
		this.socket = io(this.options.url, {
			path: this.options.path ?? '/socket.io',
			transports: ['websocket', 'polling']
		});

		this.socket.on('connect', () => this._onSocketConnection());
		this.socket.on('connect_error', () => {
			this.state.connectionError.set(true);
		});
		this.socket.on('disconnect', () => {
			this.state.connectionError.set(false);
			this.state.connected.set(false);
			this.socket.disconnect();
			window.location.reload();
		});
	}

	/**
	 * Starts initial subscriptions and listens for incoming data after we connect to the backend.
	 */
	private _onSocketConnection() {
		// Set account name
		this.socket.on('@set/accountData', data => {
			this.state.setAccountName(data.name);
		});

		// Set assets list
		// This is only invoked during initialization and when asset order changes
		this.socket.on('@set/assets', (dto: WebAssetDto[]) => {
			this.state.setAssets(
				this.transformer.getWebAssets(dto)
			);
		});

		// Set account balance
		this.socket.on('@set/balance', (dto: WebBalanceDto) => {
			this.state.setAccountBalance(
				this.transformer.getWebBalance(dto)
			);
		});

		// Update assets
		this.socket.on('@update/asset', (dto: WebAssetDto) => {
			this.state.updateAsset(dto);
		});

		// Update current chart tick
		this.socket.on('@chart/current', (dto: WebChartData) => {
			this.chart.updateChartCurrent(dto);
		});

		// Update full chart data
		this.socket.on('@chart/data', (dto: WebChartData[]) => {
			this.chart.updateChartData(dto);
		});

		// Send chart corrections
		this.socket.on('@chart/correction', (dto: WebChartCorrection) => {
			this.chart.sendDataCorrection(dto);
		});

		this.socket.on('@init/finished', () => {
			this.state.connected.set(true);
		});

		// Start the connection
		this.socket.emit('subscribe', this.options.account);

		// Listen for tasks
		this.socket.on('task', (task: any) => {
			if (task === undefined && this.state.task.get() !== undefined) {
				this.state.task.set({
					...this.state.task.get(),
					progress: 100
				});

				setTimeout(() => this.state.task.set(undefined), 1200);
				return;
			}

			this.state.task.set(task);
		});

		// Start the chart
		this.chart.init('@total', this.chart.interval.get(), 'balance');
	}

}

export interface IWebEngineOptions {
	url: string;
	path?: string;
	account: string;
}
