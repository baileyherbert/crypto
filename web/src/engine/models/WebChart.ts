import type { Interval } from '../managers/ChartManager';

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

export type WebChartType = 'market' | 'balance';

export interface WebChartCorrection extends WebChartData {
	name: string;
	interval: Interval;
}
